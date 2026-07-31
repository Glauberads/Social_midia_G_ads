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
  const [memberships, setMemberships] = useState<any[]>([]);

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
        const ctx = await resContext.json();
        setTenantContext(ctx);

        if (ctx.role === 'OWNER' || ctx.role === 'ADMIN') {
          const resMemberships = await fetch('http://localhost:3001/api/memberships', {
            headers: {
              'Authorization': `Bearer ${data.session.access_token}`,
              'x-tenant-id': selectedTenantId
            }
          });
          if (resMemberships.ok) {
            setMemberships(await resMemberships.json());
          }
        } else {
          setMemberships([]);
        }
      } else {
        setTenantContext(null);
        setMemberships([]);
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

  async function loadMemberships() {
    const { data } = await supabase.auth.getSession();
    if (!data.session || !selectedTenantId) return;
    const res = await fetch('http://localhost:3001/api/memberships', {
      headers: {
        'Authorization': `Bearer ${data.session.access_token}`,
        'x-tenant-id': selectedTenantId
      }
    });
    if (res.ok) setMemberships(await res.json());
  }

  async function handleChangeRole(membershipId: string, role: string) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`http://localhost:3001/api/memberships/${membershipId}/role`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${data.session?.access_token}`,
        'x-tenant-id': selectedTenantId!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    });
    if (res.ok) {
      alert('Role alterada.');
      loadMemberships();
    } else {
      alert('Erro ao alterar role.');
    }
  }

  async function handleChangeStatus(membershipId: string, status: string) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`http://localhost:3001/api/memberships/${membershipId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${data.session?.access_token}`,
        'x-tenant-id': selectedTenantId!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      alert('Status alterado.');
      loadMemberships();
    } else {
      alert('Erro ao alterar status.');
    }
  }

  async function handleRemove(membershipId: string) {
    if (!confirm('Deseja realmente remover?')) return;
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`http://localhost:3001/api/memberships/${membershipId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${data.session?.access_token}`,
        'x-tenant-id': selectedTenantId!
      }
    });
    if (res.ok) {
      alert('Membro removido.');
      loadMemberships();
    } else {
      alert('Erro ao remover membro.');
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
          <div className="flex-1 p-10">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                    Tenant ID: {tenantContext.tenantId.substring(0, 8)}...
                  </span>
                  <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                    Role: {tenantContext.role}
                  </span>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Bem-vindo(a) ao seu Workspace</h2>
                <p className="text-gray-500">
                  O isolamento de dados via TenantContext e AsyncLocalStorage está ativo e validado sob alta concorrência.
                </p>
              </div>

              <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">Membros da Equipe</h3>
                  <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                    (Gestão RBAC Integrada)
                  </span>
                </div>
                <div className="p-6">
                  {memberships.length > 0 ? (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2">Email</th>
                          <th className="py-2">Role</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberships.map((m: any) => (
                          <tr key={m.id} className="border-b">
                            <td className="py-2">{m.email}</td>
                            <td className="py-2">
                              <select 
                                value={m.role} 
                                onChange={(e) => handleChangeRole(m.id, e.target.value)}
                                disabled={tenantContext.role === 'MEMBER' || tenantContext.role === 'VIEWER'}
                                className="border rounded p-1"
                              >
                                <option value="OWNER">OWNER</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                            </td>
                            <td className="py-2">
                              {m.status}
                            </td>
                            <td className="py-2 space-x-2">
                              {(tenantContext.role === 'OWNER' || tenantContext.role === 'ADMIN') && (
                                <>
                                  {m.status === 'ACTIVE' ? (
                                    <button onClick={() => handleChangeStatus(m.id, 'SUSPENDED')} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Suspender</button>
                                  ) : (
                                    <button onClick={() => handleChangeStatus(m.id, 'ACTIVE')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Reativar</button>
                                  )}
                                  <button onClick={() => handleRemove(m.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Remover</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">
                      Você não tem permissão para gerenciar memberships, ou não há membros.
                    </p>
                  )}
                </div>
              </div>
            </div>
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
