'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  id: string;
  email: string;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        window.location.href = '/login';
      } else {
        fetchProfile(s.access_token);
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

  const fetchProfile = async (token: string) => {
    try {
      // Use local API for testing, or public URL from config.
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const res = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

      <button onClick={handleLogout} style={{ marginTop: '2rem' }}>Sair (Logout)</button>
    </div>
  );
}
