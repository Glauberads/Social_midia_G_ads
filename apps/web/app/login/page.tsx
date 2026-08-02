'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthShell } from '../components/AuthShell';
import { FormField, safeErrorMessage } from '../components/ui';
import { Icon } from '../components/Icon';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage(safeErrorMessage(error, 'Não foi possível entrar. Verifique seus dados e tente novamente.')); setLoading(false); return; }
    window.location.href = '/dashboard';
  };

  return <AuthShell title="Seu conteúdo começa com clareza." description="Centralize solicitações, organize a produção e mantenha todo o time alinhado em um fluxo simples."><div className="auth-card"><div className="auth-card-header"><div className="eyebrow">Bem-vindo de volta</div><h2>Acesse sua conta</h2><p>Entre para continuar no seu workspace.</p></div><form className="auth-form" onSubmit={handleLogin}><FormField id="email" label="E-mail"><input id="email" className="input" type="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></FormField><FormField id="password" label="Senha"><input id="password" className="input" type="password" autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(event) => setPassword(event.target.value)} required /></FormField>{message && <div className="notice notice-error" role="alert">{message}</div>}<button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Entrando...' : <>Entrar no workspace <Icon name="arrow-right" size={17} /></>}</button></form><div className="auth-footer">Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link></div></div></AuthShell>;
}
