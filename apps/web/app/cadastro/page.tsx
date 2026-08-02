'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthShell } from '../components/AuthShell';
import { FormField, safeErrorMessage } from '../components/ui';
import { Icon } from '../components/Icon';

export default function CadastroPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage('');
    setSuccess(false);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setMessage(safeErrorMessage(error, 'Não foi possível criar a conta. Revise os dados e tente novamente.')); setLoading(false); return; }
    setSuccess(true);
    setMessage('Conta criada. Agora você já pode acessar o seu workspace.');
    setLoading(false);
  };

  return <AuthShell title="Um processo melhor para criar conteúdo." description="Comece com um workspace organizado e transforme cada briefing em trabalho acionável para sua equipe."><div className="auth-card"><div className="auth-card-header"><div className="eyebrow">Comece agora</div><h2>Crie sua conta</h2><p>Use um e-mail válido para configurar seu acesso.</p></div><form className="auth-form" onSubmit={handleSignup}><FormField id="email" label="E-mail"><input id="email" className="input" type="email" autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></FormField><FormField id="password" label="Senha" hint="Use ao menos 6 caracteres."><input id="password" className="input" type="password" minLength={6} autoComplete="new-password" placeholder="Crie uma senha segura" value={password} onChange={(event) => setPassword(event.target.value)} required aria-describedby="password-help" /></FormField>{message && <div className={`notice ${success ? 'notice-success' : 'notice-error'}`} role="status">{message}</div>}<button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Criando conta...' : <>Criar minha conta <Icon name="arrow-right" size={17} /></>}</button></form><div className="auth-footer">Já tem uma conta? <Link href="/login">Fazer login</Link></div></div></AuthShell>;
}
