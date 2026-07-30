'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  id: string;
  email: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  membership: { role: string; status: string };
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string>('');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantError, setTenantError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        window.location.href = '/login';
      } else {
        setToken(s.access_token);
        fetchProfile(s.access_token);
        fetchTenants(s.access_token);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          window.location.href = '/login';
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (accessToken: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sessão expirada ou inválida. Faça login novamente.');
          supabase.auth.signOut();
        } else if (res.status === 409) {
          setError('Perfil ainda não sincronizado (AUTH_PROFILE_NOT_PROVISIONED). Tente novamente em instantes.');
        } else {
          setError(`Erro na API: ${res.status}`);
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data);
      setLoading(false);
    } catch (e) {
      setError(`Falha ao conectar com API: ${(e as Error).message}`);
      setLoading(false);
    }
  };

  const fetchTenants = async (accessToken: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/tenants`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (e) {
      console.error('Falha ao buscar tenants', e);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setTenantError('');
    setCreating(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/tenants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: tenantName, slug: tenantSlug })
      });

      if (res.status === 409) {
        setTenantError('Este slug já está em uso ou é reservado.');
      } else if (!res.ok) {
        const data = await res.json();
        setTenantError(data.message?.join(', ') || 'Erro de validação');
      } else {
        setTenantName('');
        setTenantSlug('');
        fetchTenants(token);
      }
    } catch (e) {
      setTenantError(`Erro de conexão: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) return <div style={{ padding: '2rem' }}>Carregando dashboard...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard Privado</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {profile && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
          <h2>Bem-vindo!</h2>
          <p><strong>ID:</strong> {profile.id}</p>
          <p><strong>E-mail:</strong> {profile.email}</p>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Criar workspace</h2>
        {tenantError && <p style={{ color: 'red' }}>{tenantError}</p>}
        <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '300px' }}>
          <input
            type="text"
            placeholder="Nome do workspace"
            value={tenantName}
            onChange={e => setTenantName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="slug (ex: meu-workspace)"
            value={tenantSlug}
            onChange={e => setTenantSlug(e.target.value)}
            required
          />
          <button type="submit" disabled={creating}>
            {creating ? 'Criando...' : 'Criar'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Meus Workspaces</h2>
        {tenants.length === 0 ? (
          <p>Você não participa de nenhum workspace.</p>
        ) : (
          <ul>
            {tenants.map(t => (
              <li key={t.id}>
                <strong>{t.name}</strong> ({t.slug}) - Papel: {t.membership.role} - Status: {t.status}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={handleLogout} style={{ marginTop: '2rem' }}>Sair (Logout)</button>
    </div>
  );
}
