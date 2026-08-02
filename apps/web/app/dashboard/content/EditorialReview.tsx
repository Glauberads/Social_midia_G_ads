'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { ConfirmDialog, FormField, LoadingSkeleton, StatusBadge, formatDate, safeErrorMessage } from '../../components/ui';
import { activeEditorialRevision, canDecideEditorial, canEditEditorial } from './editorial-state';

interface Revision {
  id: string; version: number; source: string; status: string; caption: string; callToAction: string; hashtags: string[];
  rejectionReason: string | null; approvedAt: string | null; approvedById: string | null; createdById: string; createdAt: string;
}

export function EditorialReview({ contentRequestId, contentStatus, onChanged }: { contentRequestId: string; contentStatus: string; onChanged: () => Promise<void> | void }) {
  const [items, setItems] = useState<Revision[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editing, setEditing] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({ caption: '', callToAction: '', hashtags: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response: { items: Revision[] } = await apiClient(`/content-requests/${contentRequestId}/revisions?limit=50`);
      setItems(response.items);
      const active = activeEditorialRevision(response.items);
      setSelectedId((current) => response.items.some((item) => item.id === current) ? current : active?.id || '');
    } catch (loadError) { setError(safeErrorMessage(loadError, 'Não foi possível carregar o histórico editorial.')); }
    finally { setLoading(false); }
  }, [contentRequestId]);

  useEffect(() => { void load(); }, [load, contentStatus]);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? activeEditorialRevision(items), [items, selectedId]);

  function beginEdit() {
    if (!selected) return;
    setForm({ caption: selected.caption, callToAction: selected.callToAction, hashtags: selected.hashtags.join(' ') });
    setEditing(true); setError(''); setFeedback('');
  }

  async function saveRevision(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.caption.trim() || !form.callToAction.trim()) return;
    const hashtags = form.hashtags.split(/\s+/).filter(Boolean).map((tag) => tag.startsWith('#') ? tag : `#${tag}`);
    setBusy(true); setError(''); setFeedback('');
    try {
      await apiClient(`/content-requests/${contentRequestId}/revisions`, { method: 'POST', body: JSON.stringify({ caption: form.caption, callToAction: form.callToAction, hashtags }) });
      setEditing(false); setFeedback('Nova revisão editorial salva.'); await load(); await onChanged();
    } catch (saveError) { setError(safeErrorMessage(saveError, 'Não foi possível salvar a revisão.')); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (busy || !selected) return;
    setBusy(true); setError('');
    try { await apiClient(`/content-requests/${contentRequestId}/revisions/${selected.id}/approve`, { method: 'POST' }); setApproveOpen(false); setFeedback('Conteúdo aprovado.'); await load(); await onChanged(); }
    catch (approveError) { setError(safeErrorMessage(approveError, 'Não foi possível aprovar esta revisão.')); setApproveOpen(false); }
    finally { setBusy(false); }
  }

  async function reject() {
    if (busy || !selected || reason.trim().length < 3) return;
    setBusy(true); setError('');
    try { await apiClient(`/content-requests/${contentRequestId}/revisions/${selected.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }); setRejectOpen(false); setReason(''); setFeedback('Revisão rejeitada. Você pode editá-la ou solicitar uma nova geração.'); await load(); await onChanged(); }
    catch (rejectError) { setError(safeErrorMessage(rejectError, 'Não foi possível rejeitar esta revisão.')); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="card detail-block" style={{ marginBottom: 18 }}><LoadingSkeleton rows={2} /></section>;
  return <section className="card detail-block" style={{ marginBottom: 18 }}>
    <div className="form-section-header"><h2>Conteúdo gerado</h2><p>Revise, edite e aprove o conteúdo antes de qualquer etapa futura.</p></div>
    {feedback && <div className="notice notice-success" role="status" style={{ marginBottom: 14 }}>{feedback}</div>}
    {error && <div className="notice notice-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
    {!selected ? <div className="empty-state"><p>Nenhuma revisão editorial disponível.</p></div> : <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }} aria-label="Versões editoriais">
        {items.map((item) => <button key={item.id} type="button" className={`button ${item.id === selected.id ? 'button-primary' : 'button-secondary'}`} onClick={() => { setSelectedId(item.id); setEditing(false); }}>v{item.version}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}><StatusBadge status={selected.status} /><strong>Versão {selected.version}</strong><span>{selected.source.replaceAll('_', ' ')}</span><small>Autor {selected.createdById.slice(0, 8)}…</small><small>{formatDate(selected.createdAt)}</small></div>
      {editing ? <form onSubmit={saveRevision} noValidate><FormField id="revision-caption" label="Legenda"><textarea id="revision-caption" className="textarea" rows={8} maxLength={2200} value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} required /></FormField><FormField id="revision-cta" label="Chamada para ação"><input id="revision-cta" className="input" maxLength={240} value={form.callToAction} onChange={(event) => setForm({ ...form, callToAction: event.target.value })} required /></FormField><FormField id="revision-hashtags" label="Hashtags" hint="Separe por espaços."><input id="revision-hashtags" className="input" value={form.hashtags} onChange={(event) => setForm({ ...form, hashtags: event.target.value })} /></FormField><div className="form-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy || !form.caption.trim() || !form.callToAction.trim()}>{busy ? 'Salvando...' : 'Salvar nova versão'}</button></div></form> : <><h3>Legenda</h3><p className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{selected.caption}</p><h3>Chamada para ação</h3><p className="detail-value">{selected.callToAction}</p><h3>Hashtags</h3><p className="detail-value">{selected.hashtags.join(' ') || '—'}</p>{selected.rejectionReason && <div className="notice notice-error"><strong>Motivo da rejeição:</strong> {selected.rejectionReason}</div>}{selected.approvedAt && <small>Aprovada em {formatDate(selected.approvedAt)}</small>}</>}
      {!editing && selected.id === activeEditorialRevision(items)?.id && <div className="form-actions">{canEditEditorial(contentStatus) && <button type="button" className="button button-secondary" disabled={busy} onClick={beginEdit}>Editar como nova versão</button>}{canDecideEditorial(contentStatus, selected.status) && <><button type="button" className="button button-danger" disabled={busy} onClick={() => setRejectOpen(true)}>Rejeitar</button><button type="button" className="button button-primary" disabled={busy} onClick={() => setApproveOpen(true)}>Aprovar</button></>}</div>}
    </>}
    <ConfirmDialog open={approveOpen} title="Aprovar esta versão?" description="A aprovação encerra o fluxo editorial e torna o conteúdo somente leitura." confirmLabel="Aprovar conteúdo" loading={busy} onConfirm={approve} onCancel={() => setApproveOpen(false)} />
    {rejectOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setRejectOpen(false)}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="reject-title"><h2 id="reject-title">Rejeitar esta versão?</h2><FormField id="rejection-reason" label="Motivo" hint="Obrigatório, entre 3 e 500 caracteres."><textarea id="rejection-reason" className="textarea" rows={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus required /></FormField><div className="dialog-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setRejectOpen(false)}>Cancelar</button><button type="button" className="button button-danger" disabled={busy || reason.trim().length < 3} onClick={reject}>{busy ? 'Processando...' : 'Rejeitar versão'}</button></div></div></div>}
  </section>;
}
