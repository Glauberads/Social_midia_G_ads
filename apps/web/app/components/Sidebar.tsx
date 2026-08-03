'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef, useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface WorkspaceOption { id: string; name: string; slug: string }

export const Sidebar = forwardRef<HTMLElement, { open: boolean; workspaces: WorkspaceOption[]; activeWorkspaceId: string | null; email: string; onWorkspaceChange: (id: string) => void; onClose: () => void; onLogout: () => void }>(function Sidebar({ open, workspaces, activeWorkspaceId, email, onWorkspaceChange, onClose, onLogout }, ref) {
  const pathname = usePathname();
  const [hash, setHash] = useState('');
  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, [pathname]);
  const items: Array<{ label: string; href: string; icon: IconName; active: boolean }> = [
    { label: 'Visão geral', href: '/dashboard', icon: 'dashboard', active: pathname === '/dashboard' && !hash },
    { label: 'Conteúdos', href: '/dashboard/content', icon: 'content', active: pathname === '/dashboard/content' || (/^\/dashboard\/content\/.+/.test(pathname) && pathname !== '/dashboard/content/new') },
    { label: 'Nova solicitação', href: '/dashboard/content/new', icon: 'plus', active: pathname === '/dashboard/content/new' },
    { label: 'Equipe', href: '/dashboard#equipe', icon: 'team', active: pathname === '/dashboard' && hash === '#equipe' },
    { label: 'Configurações', href: '/dashboard#configuracoes', icon: 'gear', active: pathname === '/dashboard' && hash === '#configuracoes' },
    { label: 'Integrações', href: '/dashboard/settings/integrations', icon: 'gear', active: pathname === '/dashboard/settings/integrations' },
  ];
  const initials = email ? email.slice(0, 2).toUpperCase() : 'SM';
  return <><aside ref={ref} id="app-sidebar" className={`sidebar ${open ? 'open' : ''}`} aria-label="Navegação principal"><Link href="/dashboard" className="brand" onClick={onClose}><span className="brand-mark"><Icon name="sparkles" size={20} /></span><span className="brand-copy"><strong>Social Media IA</strong><span>Content workspace</span></span></Link><div className="workspace-picker"><label htmlFor="workspace-select">Workspace ativo</label><select id="workspace-select" value={activeWorkspaceId || ''} onChange={(event) => onWorkspaceChange(event.target.value)} disabled={workspaces.length === 0}><option value="">{workspaces.length ? 'Selecione' : 'Nenhum workspace'}</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></div><nav className="sidebar-nav"><div className="nav-label">Workspace</div>{items.slice(0, 3).map((item) => <Link key={item.label} href={item.href} className={`nav-item ${item.active ? 'active' : ''}`} onClick={onClose}><Icon name={item.icon} size={18} />{item.label}</Link>)}<div className="nav-label">Administração</div>{items.slice(3).map((item) => <Link key={item.label} href={item.href} className={`nav-item ${item.active ? 'active' : ''}`} onClick={onClose}><Icon name={item.icon} size={18} />{item.label}</Link>)}</nav><div className="sidebar-footer"><div className="user-card"><span className="avatar">{initials}</span><span className="user-copy"><strong>Sessão ativa</strong><span>{email || 'Carregando perfil...'}</span></span></div><button className="button sidebar-logout" onClick={onLogout}><Icon name="logout" size={18} />Sair da conta</button></div></aside>{open && <button className="sidebar-scrim" onClick={onClose} aria-label="Fechar menu" />}</>;
});
