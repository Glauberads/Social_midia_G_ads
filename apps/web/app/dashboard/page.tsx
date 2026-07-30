'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Tenants and selection
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [tenantContext, setTenantContext] = useState<{ tenantId: string; role: string; membershipId: string } | null>(null);
  const [newTenantName, setNewTenantName] = useState('');

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.push('/login');
        return;
      }

      const token = data.session.access_token;

      // Fetch user profile
      const resProfile = await fetch('http://localhost:3001/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resProfile.ok) {
        router.push('/login');
        return;
      }

      setProfile(await resProfile.json());

      // Fetch tenants
      const resTenants = await fetch('http://localhost:3001/api/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (resTenants.ok) {
        const list = await resTenants.json();
        setTenants(list);

        // Auto-select preferred or first
        const savedTenantId = localStorage.getItem('glauberads_preferred_tenant');
        if (savedTenantId && list.find((t: { id: string }) => t.id === savedTenantId)) {
          setSelectedTenantId(savedTenantId);
        } else if (list.length > 0) {
          setSelectedTenantId(list[0].id);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  // Load Context when tenant changes
  useEffect(() => {
    async function loadContext() {
      if (!selectedTenantId) {
        setTenantContext(null);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      localStorage.setItem('glauberads_preferred_tenant', selectedTenantId);

      const resContext = await fetch('http://localhost:3001/api/tenant-context', {
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
          'x-tenant-id': selectedTenantId
        }
      });

      if (resContext.ok) {
        setTenantContext(await resContext.json());
      } else {
        setTenantContext(null);
      }
    }

    loadContext();
  }, [selectedTenantId]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleCreateTenant() {
    if (!newTenantName) return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const slug = newTenantName.toLowerCase().replace(/\s+/g, '-');

    const res = await fetch('http://localhost:3001/api/tenants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: newTenantName, slug })
    });

    if (res.ok) {
      const tenant = await res.json();
      setTenants([...tenants, tenant]);
      setNewTenantName('');
      setSelectedTenantId(tenant.id); // Auto-select new tenant
    } else {
      if (res.status === 409) {
        alert('Este nome/slug já está em uso.');
      } else {
        alert('Erro ao criar workspace.');
      }
    }
  }

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen text-gray-800">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button onClick={handleLogout} className="text-sm bg-red-100 text-red-600 px-4 py-2 rounded">
          Sair
        </button>
      </div>

      <div className="bg-white p-6 rounded shadow max-w-xl">
        <h2 className="text-xl font-semibold mb-4">Perfil Autenticado</h2>
        <p><strong>ID:</strong> {profile?.id}</p>
        <p><strong>Email:</strong> {profile?.email}</p>
      </div>

      <div className="bg-white p-6 rounded shadow max-w-xl space-y-4">
        <h2 className="text-xl font-semibold">Meus Workspaces</h2>

        {tenants.length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Workspace Ativo:</label>
            <select
              value={selectedTenantId || ''}
              onChange={e => setSelectedTenantId(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="" disabled>Selecione...</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-gray-500">Você ainda não tem nenhum workspace.</p>
        )}

        {tenantContext && (
          <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
            <h3 className="font-semibold text-green-800 mb-2">Contexto Tenant Ativo (Validado via API)</h3>
            <p className="text-sm text-green-700"><strong>Tenant ID:</strong> {tenantContext.tenantId}</p>
            <p className="text-sm text-green-700"><strong>Minha Role:</strong> {tenantContext.role}</p>
            <p className="text-sm text-green-700"><strong>Membership ID:</strong> {tenantContext.membershipId}</p>
          </div>
        )}

        <div className="pt-4 border-t">
          <h3 className="text-lg font-medium mb-2">Criar Novo Workspace</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome do Workspace"
              value={newTenantName}
              onChange={e => setNewTenantName(e.target.value)}
              className="border p-2 rounded flex-1"
            />
            <button
              onClick={handleCreateTenant}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
