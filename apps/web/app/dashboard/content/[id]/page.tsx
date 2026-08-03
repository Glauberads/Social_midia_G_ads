'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/apiClient';
import { useWorkspace } from '../../../components/AppShell';
import { Icon } from '../../../components/Icon';
import { ConfirmDialog, ErrorState, FormField, LoadingSkeleton, PageHeader, PlatformSelector, StatusBadge, formatDate, formatPlatform, safeErrorMessage } from '../../../components/ui';
import { canSubmitGeneration, generationEndpoint, shouldPollGeneration } from '../generation-state';
import { EditorialReview } from '../EditorialReview';
import { ScheduleModal } from '../../../components/calendar/ScheduleModal';

interface ContentRequest {
  id: string;
  title: string;
  briefing: string;
  objective: string | null;
  audience: string | null;
  tone: string | null;
  platform: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  latestGeneration: null | {
    id: string; status: string; provider: string; model: string; promptVersion: string; attempt: number;
    errorCode: string | null; errorMessage: string | null; completedAt: string | null;
    generatedContent: null | { caption: string; callToAction: string; hashtags: string[]; version: number; createdAt: string };
  };
  schedule?: {
    id: string;
    status: string;
    scheduledFor: string;
    timezone: string;
  };
}

export default function ContentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { activeWorkspaceId } = useWorkspace();
  const [data, setData] = useState<ContentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generationConfirmOpen, setGenerationConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ title: '', briefing: '', objective: '', audience: '', tone: '', platform: 'INSTAGRAM_FEED' });
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState<any>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    if (!silent) setData(null);
    try {
      const request: ContentRequest = await apiClient(`/content-requests/${id}`);
      setData(request);
      setForm({ title: request.title, briefing: request.briefing, objective: request.objective || '', audience: request.audience || '', tone: request.tone || '', platform: request.platform });
      
      // Fetch schedule if request is APPROVED
      if (request.status === 'APPROVED') {
        const scheduleRes = await apiClient(`/content-requests/${id}/schedule`).catch(() => null);
        setScheduleData(scheduleRes || null);
      }
    } catch (loadError) { setError(safeErrorMessage(loadError, 'Não foi possível carregar os detalhes da solicitação.')); }
    finally { if (!silent) setLoading(false); }
  }, [activeWorkspaceId, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data || !shouldPollGeneration(data.status)) return;
    const timer = window.setInterval(() => { void load(true); }, 4000);
    return () => window.clearInterval(timer);
  }, [data?.status, load]);
  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); setEditErrors((current) => ({ ...current, [field]: '' })); }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = 'Informe um título para identificar a solicitação.';
    if (!form.briefing.trim()) nextErrors.briefing = 'Descreva o briefing da solicitação.';
    else if (form.briefing.trim().length < 10) nextErrors.briefing = 'O briefing precisa ter ao menos 10 caracteres.';
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setError('');
    setFeedback('');
    try { const response = await apiClient(`/content-requests/${id}`, { method: 'PATCH', body: JSON.stringify(form) }); setData(response); setEditMode(false); setFeedback('Alterações salvas com sucesso.'); }
    catch (updateError) { setError(safeErrorMessage(updateError, 'Não foi possível atualizar a solicitação.')); }
    finally { setSaving(false); }
  };

  const handleArchive = async () => {
    if (archiving) return;
    setArchiving(true);
    setError('');
    try { await apiClient(`/content-requests/${id}/archive`, { method: 'POST' }); setData((current) => current ? { ...current, status: 'ARCHIVED' } : current); setFeedback('Solicitação arquivada com sucesso.'); setConfirmOpen(false); }
    catch (archiveError) { setError(safeErrorMessage(archiveError, 'Não foi possível arquivar a solicitação.')); setConfirmOpen(false); }
    finally { setArchiving(false); }
  };

  const handleGenerate = async () => {
    if (submitting || !data) return;
    setSubmitting(true); setError(''); setFeedback('');
    try {
      const endpoint = generationEndpoint(id, data.status);
      await apiClient(endpoint, { method: 'POST' });
      setGenerationConfirmOpen(false);
      setFeedback(data.status === 'FAILED' ? 'Nova tentativa enviada para geração.' : 'Solicitação enviada para geração.');
      await load(true);
    } catch (submitError) { setError(safeErrorMessage(submitError, 'Não foi possível enviar a solicitação para geração.')); setGenerationConfirmOpen(false); }
    finally { setSubmitting(false); }
  };

  if (loading) return <><div className="skeleton" style={{ height: 120, marginBottom: 18 }} /><LoadingSkeleton rows={3} /></>;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ErrorState message="A solicitação não foi encontrada." />;
  const canEdit = data.status === 'DRAFT' || data.status === 'REJECTED';
  const canSubmit = canSubmitGeneration(data.status);

  return <>
    <PageHeader eyebrow="Detalhes da solicitação" title={data.title} description={`${formatPlatform(data.platform)} · Criado em ${formatDate(data.createdAt)}`} actions={<>
      <button className="button button-secondary" onClick={() => router.push('/dashboard/content')}><Icon name="arrow-left" size={17} />Voltar</button>
      {canEdit && !editMode && <button className="button button-secondary" onClick={() => setEditMode(true)}><Icon name="edit" size={16} />Editar briefing</button>}
      {canSubmit && !editMode && <button className="button button-primary" disabled={submitting} onClick={() => setGenerationConfirmOpen(true)}><Icon name="sparkles" size={16} />{data.status === 'FAILED' ? 'Tentar novamente' : data.status === 'REJECTED' ? 'Gerar nova versão' : 'Enviar para geração'}</button>}
      {data.status === 'APPROVED' && !editMode && <button className="button button-primary" onClick={() => setScheduleModalOpen(true)}><Icon name="calendar" size={16} />{scheduleData ? 'Reagendar' : 'Agendar'}</button>}
      {data.status !== 'ARCHIVED' && data.status !== 'APPROVED' && data.status !== 'SUBMITTED' && data.status !== 'GENERATING' && <button className="button button-danger" onClick={() => setConfirmOpen(true)}><Icon name="archive" size={16} />Arquivar</button>}
    </>} />
    <div style={{ marginBottom: 18 }}><StatusBadge status={data.status} /></div>
    {feedback && <div className="notice notice-success" role="status" style={{ marginBottom: 18 }}>{feedback}</div>}
    {error && <div className="notice notice-error" role="alert" style={{ marginBottom: 18 }}>{error}</div>}
    {(data.status === 'SUBMITTED' || data.status === 'GENERATING') && <div className="notice notice-info" role="status" style={{ marginBottom: 18 }}><strong>{data.status === 'SUBMITTED' ? 'Solicitação na fila.' : 'Conteúdo sendo gerado.'}</strong> Esta página será atualizada automaticamente a cada 4 segundos.</div>}
    {data.status === 'FAILED' && <div className="notice notice-error" role="alert" style={{ marginBottom: 18 }}><strong>A geração não foi concluída.</strong> {data.latestGeneration?.errorMessage || 'Tente novamente em alguns instantes.'}{data.latestGeneration?.errorCode && <div style={{ marginTop: 6 }}>Código: {data.latestGeneration.errorCode}</div>}</div>}
    {['READY', 'REJECTED', 'APPROVED'].includes(data.status) && <EditorialReview contentRequestId={id} contentStatus={data.status} onChanged={() => load(true)} />}
    {editMode ? <form className="card form-card" onSubmit={handleUpdate} noValidate><section className="form-section"><div className="form-section-header"><h2>Editar solicitação</h2><p>Atualize as informações do briefing enquanto ele está em um status editável.</p></div><div className="form-grid"><div className="form-span-2"><FormField id="edit-title" label="Título" error={editErrors.title} count={`${form.title.length} caracteres`}><input id="edit-title" className="input" value={form.title} onChange={(event) => update('title', event.target.value)} required aria-invalid={Boolean(editErrors.title)} aria-describedby="edit-title-help" /></FormField></div><div className="form-span-2"><FormField id="edit-briefing" label="Briefing" hint="Mínimo de 10 caracteres." error={editErrors.briefing} count={`${form.briefing.length} caracteres`}><textarea id="edit-briefing" className="textarea" value={form.briefing} onChange={(event) => update('briefing', event.target.value)} rows={7} required aria-invalid={Boolean(editErrors.briefing)} aria-describedby="edit-briefing-help" /></FormField></div><FormField id="edit-objective" label="Objetivo"><input id="edit-objective" className="input" value={form.objective} onChange={(event) => update('objective', event.target.value)} /></FormField><FormField id="edit-audience" label="Público-alvo"><input id="edit-audience" className="input" value={form.audience} onChange={(event) => update('audience', event.target.value)} /></FormField><div className="form-span-2"><FormField id="edit-tone" label="Tom de voz"><input id="edit-tone" className="input" value={form.tone} onChange={(event) => update('tone', event.target.value)} /></FormField></div></div></section><section className="form-section"><div className="form-section-header"><h2>Plataforma</h2></div><PlatformSelector value={form.platform} onChange={(value) => update('platform', value)} name="edit-platform" /></section><footer className="form-actions"><button className="button button-secondary" type="button" onClick={() => setEditMode(false)} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : <><Icon name="check" size={17} />Salvar alterações</>}</button></footer></form> : <div className="details-grid"><div className="details-main"><section className="card detail-block"><div className="detail-label"><Icon name="brief" size={15} />Briefing</div><p className="detail-value">{data.briefing}</p></section><section className="card detail-block"><div className="detail-label"><Icon name="sparkles" size={15} />Objetivo</div><p className="detail-value">{data.objective || 'Não informado'}</p></section><div className="form-grid"><section className="card detail-block"><div className="detail-label"><Icon name="team" size={15} />Público-alvo</div><p className="detail-value">{data.audience || 'Não informado'}</p></section><section className="card detail-block"><div className="detail-label"><Icon name="send" size={15} />Tom de voz</div><p className="detail-value">{data.tone || 'Não informado'}</p></section></div>{data.status === 'ARCHIVED' && <div className="notice notice-info"><strong>Modo somente leitura.</strong> Esta solicitação foi arquivada e não pode mais ser editada.</div>}</div><aside className="details-side"><section className="card meta-list"><div className="meta-item"><span>Status</span><StatusBadge status={data.status} /></div>
    {scheduleData && (
      <div className="meta-item">
        <span>Agendamento</span>
        <strong>{new Date(scheduleData.scheduledFor).toLocaleString()} ({scheduleData.status})</strong>
      </div>
    )}
    <div className="meta-item"><span>Plataforma</span><strong>{formatPlatform(data.platform)}</strong></div><div className="meta-item"><span>Criado em</span><strong>{formatDate(data.createdAt)}</strong></div><div className="meta-item"><span>Atualizado em</span><strong>{formatDate(data.updatedAt)}</strong></div><div className="meta-item"><span>Autor</span><strong title={data.createdById}>{data.createdById ? `${data.createdById.slice(0, 8)}…` : '—'}</strong></div></section></aside></div>}
    <ConfirmDialog open={confirmOpen} title="Arquivar solicitação?" description="Ela sairá do fluxo ativo e passará a ser exibida em modo somente leitura." confirmLabel="Arquivar solicitação" loading={archiving} onConfirm={handleArchive} onCancel={() => setConfirmOpen(false)} />
    <ConfirmDialog open={generationConfirmOpen} title={data.status === 'FAILED' ? 'Tentar gerar novamente?' : 'Enviar para geração?'} description="O briefing será colocado na fila e não poderá ser editado durante ou após esta geração." confirmLabel={data.status === 'FAILED' ? 'Tentar novamente' : 'Enviar para geração'} loading={submitting} onConfirm={handleGenerate} onCancel={() => setGenerationConfirmOpen(false)} />
    <ScheduleModal
      contentRequestId={id}
      isOpen={scheduleModalOpen}
      existingSchedule={scheduleData}
      onClose={() => setScheduleModalOpen(false)}
      onSuccess={() => {
        setScheduleModalOpen(false);
        setFeedback(scheduleData ? 'Conteúdo reagendado com sucesso!' : 'Conteúdo agendado com sucesso!');
        load(true);
      }}
    />
  </>;
}
