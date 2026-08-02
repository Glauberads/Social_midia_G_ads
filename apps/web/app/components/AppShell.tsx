'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { Header } from './Header';
import { Sidebar, type WorkspaceOption } from './Sidebar';
import { LoadingSkeleton } from './ui';

interface Profile { id: string; email: string }
interface WorkspaceContextValue {
  profile: Profile | null;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceOption | null;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside AppShell');
  return context;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const refreshWorkspaces = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const response = await fetch(`${API_URL}/tenants`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
    if (!response.ok) return;
    const list: WorkspaceOption[] = await response.json();
    setWorkspaces(list);
    const saved = localStorage.getItem('glauberads_preferred_tenant');
    setActiveWorkspaceState((current) => {
      const candidate = current || saved;
      return candidate && list.some((workspace) => workspace.id === candidate) ? candidate : list[0]?.id || null;
    });
  }, []);

  useEffect(() => {
    async function bootstrap() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) { router.replace('/login'); return; }
      const response = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (!response.ok) { router.replace('/login'); return; }
      setProfile(await response.json());
      await refreshWorkspaces();
      setLoading(false);
    }
    bootstrap();
  }, [refreshWorkspaces, router]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceState(id || null);
    if (id) localStorage.setItem('glauberads_preferred_tenant', id);
    else localStorage.removeItem('glauberads_preferred_tenant');
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem('glauberads_preferred_tenant', activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = sidebarRef.current;
    const focusable = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled])') || []);
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia('(max-width: 820px)').matches) document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  async function logout() { await supabase.auth.signOut(); router.replace('/login'); }
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const value = useMemo(() => ({ profile, workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, refreshWorkspaces }), [profile, workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, refreshWorkspaces]);

  return <WorkspaceContext.Provider value={value}><div className="app-shell"><Sidebar ref={sidebarRef} open={menuOpen} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} email={profile?.email || ''} onWorkspaceChange={setActiveWorkspaceId} onClose={() => setMenuOpen(false)} onLogout={logout} /><div className="app-main"><Header menuButtonRef={menuButtonRef} menuOpen={menuOpen} workspaceName={activeWorkspace?.name || ''} onMenuOpen={() => setMenuOpen(true)} /><main className="page-content">{loading ? <LoadingSkeleton rows={5} /> : children}</main></div></div></WorkspaceContext.Provider>;
}
