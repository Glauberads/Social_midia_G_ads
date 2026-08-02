'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '../../lib/apiClient';
import { AuthShell } from '../../components/AuthShell';
import { Icon } from '../../components/Icon';
import { safeErrorMessage } from '../../components/ui';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => { if (token) window.history.replaceState({}, document.title, '/convite/aceitar'); }, [token]);

  const accept = async () => {
    if (!token) { setStatus('error'); setMessage('O token não foi encontrado ou o link já foi consumido. Abra novamente o convite original.'); return; }
    if (status === 'loading') return;
    setStatus('loading');
    try {
      await apiClient('/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) });
      setStatus('success');
      setMessage('Convite aceito. Estamos abrindo o seu workspace...');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (acceptError) { setStatus('error'); setMessage(safeErrorMessage(acceptError, 'Não foi possível aceitar este convite. Verifique o link e tente novamente.')); }
  };

  return <div className="auth-card"><div className="auth-card-header"><div className="state-icon"><Icon name="mail" size={25} /></div><div className="eyebrow">Convite de workspace</div><h2>Você foi convidado</h2><p>Confirme abaixo para entrar no workspace e colaborar com a equipe.</p></div>{message && <div className={`notice ${status === 'success' ? 'notice-success' : 'notice-error'}`} role="status">{message}</div>}<button className="button button-primary auth-submit" onClick={accept} disabled={status === 'loading' || status === 'success'} style={{ marginTop: 18 }}>{status === 'loading' ? 'Aceitando convite...' : status === 'success' ? 'Convite aceito' : <>Aceitar convite <Icon name="arrow-right" size={17} /></>}</button><div className="auth-footer"><Link href="/login">Voltar para o login</Link></div></div>;
}

export default function AcceptInvitationPage() {
  return <AuthShell title="Colaboração começa com contexto." description="Entre no workspace da sua equipe e acompanhe as solicitações de conteúdo em um só lugar."><Suspense fallback={<div className="auth-card"><div className="skeleton skeleton-card" /></div>}><AcceptInvitationForm /></Suspense></AuthShell>;
}
