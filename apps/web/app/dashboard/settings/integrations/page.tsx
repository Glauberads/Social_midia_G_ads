'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/apiClient';
import { PageHeader, ConfirmDialog, safeErrorMessage, LoadingSkeleton } from '../../../components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectionStatus {
  connected: boolean;
  status: string;
  provider?: string;
  instagramUsername?: string;
  pageName?: string;
  connectedAt?: string;
  tokenExpiresAt?: string;
  lastValidatedAt?: string;
}

interface InstagramAccount {
  pageId: string;
  pageName: string;
  instagramAccountId: string;
  instagramUsername: string;
}

/**
 * Phase of the page UI.
 * NOTE: The session is tracked exclusively via an HTTP-only cookie on the API.
 * There is NO sessionId in state, URL, DOM, localStorage or sessionStorage.
 */
type Phase = 'idle' | 'loading' | 'selecting-account' | 'confirming-disconnect' | 'error';

// ─── Account Selection Modal ──────────────────────────────────────────────────

function AccountSelectionModal({
  accounts,
  onSelect,
  onClose,
  loading,
}: {
  accounts: InstagramAccount[];
  onSelect: (account: InstagramAccount) => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="account-select-title" style={{ maxWidth: 480 }}>
        <h2 id="account-select-title" style={{ marginBottom: 4 }}>Selecione a conta do Instagram</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
          Escolha qual conta profissional vincular a este workspace.
        </p>

        {accounts.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-2)' }}>
            Nenhuma conta profissional encontrada. Verifique se sua página do Facebook possui uma conta Instagram Business ou Creator vinculada.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {accounts.map((account) => (
              <button
                key={account.instagramAccountId}
                id={`account-${account.instagramAccountId}`}
                className="button button-secondary"
                style={{ justifyContent: 'flex-start', gap: 12, padding: '12px 16px', textAlign: 'left' }}
                onClick={() => onSelect(account)}
                disabled={loading}
                aria-label={`Selecionar @${account.instagramUsername} (${account.pageName})`}
              >
                <span style={{ fontSize: 22 }}>📸</span>
                <span>
                  <strong>@{account.instagramUsername}</strong>
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{account.pageName}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="dialog-actions" style={{ marginTop: 20 }}>
          <button className="button button-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function InstagramIntegrationCard({
  status,
  onConnect,
  onReconnect,
  onDisconnect,
  loading,
}: {
  status: ConnectionStatus | null;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  loading: boolean;
}) {
  const connected = status?.status === 'CONNECTED';

  return (
    <article
      className="stat-card"
      id="integration-card-instagram"
      style={{
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 520,
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
        border: `1px solid ${connected ? 'rgba(34, 197, 94, 0.4)' : 'var(--border)'}`,
        transition: 'border-color 0.2s',
      }}
      aria-label="Integração Instagram via Meta"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
        }}>
          📷
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Instagram via Meta</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>Conta profissional (Business / Creator)</p>
        </div>

        {/* Status badge */}
        <div style={{ marginLeft: 'auto' }}>
          <span
            id="integration-status-badge"
            className={`badge badge-${connected ? 'approved' : 'draft'}`}
            style={{ fontSize: 12 }}
          >
            {connected ? 'Conectado' : status?.status === 'DISCONNECTED' ? 'Desconectado' : status?.status ?? 'Não conectado'}
          </span>
        </div>
      </div>

      {/* Connected state details */}
      {connected && status && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-2)' }}>Conta</span>
            <strong id="connected-username">{status.instagramUsername ? `@${status.instagramUsername}` : '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-2)' }}>Página</span>
            <span>{status.pageName ?? '—'}</span>
          </div>
          {status.tokenExpiresAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-2)' }}>Token válido até</span>
              <span>{new Date(status.tokenExpiresAt).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
          {status.lastValidatedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-2)' }}>Última validação</span>
              <span>{new Date(status.lastValidatedAt).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>
      )}

      {/* Test environment notice */}
      <div style={{
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        color: '#d97706',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}>
        <span style={{ flexShrink: 0 }}>⚠️</span>
        <span>
          <strong>Ambiente de testes.</strong> Apenas usuários cadastrados como &quot;Test Users&quot; no app Meta conseguem conectar sem aprovação da loja.
          A publicação de conteúdo não está disponível neste incremento.
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {!connected ? (
          <button
            id="btn-connect-instagram"
            className="button button-primary"
            onClick={onConnect}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Conectando...' : '🔗 Conectar Instagram'}
          </button>
        ) : (
          <>
            <button
              id="btn-reconnect-instagram"
              className="button button-secondary"
              onClick={onReconnect}
              disabled={loading}
            >
              🔄 Reconectar
            </button>
            <button
              id="btn-disconnect-instagram"
              className="button button-danger"
              onClick={onDisconnect}
              disabled={loading}
            >
              Desconectar
            </button>
          </>
        )}
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectingLoading, setSelectingLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiClient('/integrations/meta/status');
      setStatus(data);
      setPhase('idle');
    } catch (err) {
      setErrorMsg(safeErrorMessage(err, 'Não foi possível carregar o status da integração.'));
      setPhase('error');
    }
  }, []);

  /**
   * On mount: check URL result codes from OAuth callback redirect.
   *
   * Security note:
   * - The session cookie is HTTP-only and is NEVER read by this page.
   * - There is NO sessionId in the URL, DOM, localStorage or sessionStorage.
   * - When ?result=session_ready, the API cookie is already set; we simply
   *   call GET /accounts which will include the cookie automatically.
   */
  useEffect(() => {
    const result = searchParams.get('result');

    if (result === 'oauth_denied') {
      setErrorMsg('O acesso foi negado. Tente novamente e autorize o app.');
      setPhase('idle');
      router.replace('/dashboard/settings/integrations');
      fetchStatus();
      return;
    }

    if (result === 'oauth_failed') {
      setErrorMsg('Ocorreu um erro ao conectar com a Meta. Tente novamente.');
      setPhase('idle');
      router.replace('/dashboard/settings/integrations');
      fetchStatus();
      return;
    }

    if (result === 'session_ready') {
      // Clean URL immediately — the session is in the HTTP-only cookie, not the URL
      router.replace('/dashboard/settings/integrations');
      // Load accounts — the browser sends the cookie automatically
      (async () => {
        try {
          setPhase('loading');
          const data = await apiClient('/integrations/meta/accounts');
          setAccounts(data.accounts ?? []);
          setPhase('selecting-account');
        } catch (err) {
          setErrorMsg(safeErrorMessage(err, 'Não foi possível listar as contas disponíveis.'));
          setPhase('idle');
          fetchStatus();
        }
      })();
      return;
    }

    fetchStatus();
  }, [fetchStatus, router, searchParams]);

  const handleConnect = async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const data = await apiClient('/integrations/meta/connect', {
        method: 'POST',
        body: JSON.stringify({ returnPath: '/dashboard/settings/integrations' }),
        headers: { 'Content-Type': 'application/json' },
      });
      // Redirect browser to Meta OAuth — backend-provided URL only
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setErrorMsg(safeErrorMessage(err, 'Não foi possível iniciar a conexão.'));
      setPhase('idle');
    }
  };

  const handleSelectAccount = async (account: InstagramAccount) => {
    setSelectingLoading(true);
    try {
      // sessionId is NOT sent in the body — it travels via HTTP-only cookie
      await apiClient('/integrations/meta/select-account', {
        method: 'POST',
        body: JSON.stringify({
          instagramAccountId: account.instagramAccountId,
          pageId: account.pageId,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      setPhase('loading');
      await fetchStatus();
    } catch (err) {
      setErrorMsg(safeErrorMessage(err, 'Não foi possível selecionar a conta.'));
      setPhase('idle');
    } finally {
      setSelectingLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setPhase('loading');
    try {
      await apiClient('/integrations/meta/disconnect', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      setErrorMsg(safeErrorMessage(err, 'Não foi possível desconectar.'));
      setPhase('idle');
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <PageHeader
          eyebrow="Configurações"
          title="Integrações"
          description="Conecte e gerencie suas contas em plataformas externas."
        />

        {errorMsg && (
          <div
            role="alert"
            id="integrations-error-banner"
            className="error-state"
            style={{ marginBottom: 20, maxWidth: 520 }}
          >
            {errorMsg}
            <button
              className="button button-secondary button-sm"
              style={{ marginTop: 10 }}
              onClick={() => { setErrorMsg(null); fetchStatus(); }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {phase === 'loading' && !accounts.length ? (
          <LoadingSkeleton rows={1} />
        ) : (
          <InstagramIntegrationCard
            status={status}
            onConnect={handleConnect}
            onReconnect={handleConnect}
            onDisconnect={() => setPhase('confirming-disconnect')}
            loading={phase === 'loading'}
          />
        )}
      </div>

      {/* Account selection modal */}
      {phase === 'selecting-account' && (
        <AccountSelectionModal
          accounts={accounts}
          onSelect={handleSelectAccount}
          onClose={() => { setPhase('idle'); fetchStatus(); }}
          loading={selectingLoading}
        />
      )}

      {/* Disconnect confirmation */}
      <ConfirmDialog
        open={phase === 'confirming-disconnect'}
        title="Desconectar Instagram?"
        description="Ao desconectar, seu workspace não terá mais acesso à conta do Instagram. Você pode reconectar a qualquer momento."
        confirmLabel="Desconectar"
        onConfirm={handleDisconnect}
        onCancel={() => setPhase('idle')}
        loading={phase === 'loading'}
      />
    </>
  );
}
