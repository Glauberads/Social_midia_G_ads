import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow"><Icon name="sparkles" size={14} />{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, note, icon, tone = 'purple' }: { label: string; value: number; note: string; icon: IconName; tone?: 'purple' | 'blue' | 'green' | 'gray' }) {
  const colors = { purple: ['#6758ee', '#eeecff'], blue: ['#3276e8', '#eaf3ff'], green: ['#16875d', '#e8f8f1'], gray: ['#667085', '#eef0f4'] };
  return (
    <article className="stat-card" style={{ '--stat-color': colors[tone][0], '--stat-accent': colors[tone][1] } as React.CSSProperties}>
      <div className="stat-top"><span className="stat-label">{label}</span><span className="stat-icon"><Icon name={icon} size={17} /></span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}

const statusLabels: Record<string, string> = { DRAFT: 'Rascunho', READY: 'Pronto', APPROVED: 'Aprovado', REJECTED: 'Rejeitado', ARCHIVED: 'Arquivado', PENDING: 'Pendente' };
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{statusLabels[status] || status}</span>;
}

export function EmptyState({ icon = 'content', title, description, action }: { icon?: IconName; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div><div className="state-icon"><Icon name={icon} size={27} /></div><h2>{title}</h2><p>{description}</p>{action}</div></div>;
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return <div className="content-list" aria-label="Carregando conteúdo" aria-busy="true">{Array.from({ length: rows }).map((_, index) => <div className="skeleton skeleton-card" key={index} />)}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-state" role="alert"><strong>Não foi possível carregar esta área.</strong><div>{message}</div>{onRetry && <button className="button button-secondary button-sm" onClick={onRetry} style={{ marginTop: 14 }}>Tentar novamente</button>}</div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', loading = false, onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel?: string; loading?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || []);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previous?.focus(); };
  }, [loading, onCancel, open]);
  if (!open) return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !loading && onCancel()}><div ref={dialogRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><div className="dialog-icon"><Icon name="archive" /></div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p><div className="dialog-actions"><button ref={cancelRef} type="button" className="button button-secondary" onClick={onCancel} disabled={loading}>Cancelar</button><button type="button" className="button button-danger" onClick={onConfirm} disabled={loading}>{loading ? 'Processando...' : confirmLabel}</button></div></div></div>;
}

export function safeErrorMessage(error: unknown, fallback: string) {
  const details = error && typeof error === 'object' ? error as { code?: string; status?: number } : {};
  if (details.code === 'invalid_credentials') return 'E-mail ou senha inválidos.';
  if (details.code === 'email_address_invalid') return 'Informe um endereço de e-mail válido.';
  if (details.code === 'weak_password') return 'A senha não atende aos requisitos de segurança.';
  if (details.code === 'user_already_exists' || details.code === 'email_exists') return 'Já existe uma conta para este e-mail.';
  if (details.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (details.status === 403) return 'Você não tem permissão para realizar esta ação.';
  if (details.status === 404) return 'O recurso solicitado não foi encontrado.';
  if (details.status === 409) return 'Não foi possível concluir porque os dados já foram alterados.';
  if (details.status === 429) return 'Muitas tentativas. Aguarde um momento e tente novamente.';
  return fallback;
}

export function FormField({ id, label, hint, error, count, children }: { id: string; label: string; hint?: string; error?: string; count?: string; children: ReactNode }) {
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label>{children}<div className="field-meta"><span className={error ? 'field-error' : 'field-hint'} id={`${id}-help`}>{error || hint}</span>{count && <span className="field-hint">{count}</span>}</div></div>;
}

const platformLabels: Record<string, string> = { INSTAGRAM_FEED: 'Instagram Feed', INSTAGRAM_STORY: 'Instagram Story', INSTAGRAM_REEL: 'Instagram Reel' };
export function PlatformSelector({ value, onChange, name = 'platform' }: { value: string; onChange: (value: string) => void; name?: string }) {
  return <div className="platform-grid" role="radiogroup" aria-label="Selecione a plataforma">{Object.entries(platformLabels).map(([key, label]) => <label className={`platform-option ${value === key ? 'selected' : ''}`} key={key}><input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} /><Icon name="instagram" size={22} /><strong>{label}</strong></label>)}</div>;
}

export function formatPlatform(platform: string) { return platformLabels[platform] || platform.replaceAll('_', ' '); }
export function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'; }
