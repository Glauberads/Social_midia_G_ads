'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // Remove token from URL immediately
      window.history.replaceState({}, document.title, '/convite/aceitar');
    }
  }, [token]);

  const accept = async () => {
    if (!token) {
      setStatus('error');
      setMessage('Token não encontrado ou já consumido da URL. Se você acabou de recarregar a página, abra o link novamente.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        setStatus('success');
        setMessage('Convite aceito com sucesso!');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        const body = await res.json();
        setStatus('error');
        setMessage(body.message || 'Erro ao aceitar convite.');
      }
    } catch {
      setStatus('error');
      setMessage('Erro na conexão.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Aceitar Convite</h1>
      {status === 'idle' && (
        <button onClick={accept} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Aceitar Convite
        </button>
      )}
      {status === 'loading' && <p>Processando...</p>}
      {status === 'success' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'error' && <p style={{ color: 'red' }}>{message}</p>}
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <AcceptInvitationForm />
    </Suspense>
  );
}
