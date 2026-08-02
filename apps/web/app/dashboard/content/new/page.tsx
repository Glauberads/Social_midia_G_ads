'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../../../lib/apiClient';
import { useWorkspace } from '../../../components/AppShell';
import { Icon } from '../../../components/Icon';
import { FormField, PageHeader, PlatformSelector, safeErrorMessage } from '../../../components/ui';

const tones = ['Profissional', 'Inspirador', 'Educativo', 'Descontraído', 'Direto'];

export default function NewContentRequestPage() {
  const router = useRouter();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const [form, setForm] = useState({ title: '', briefing: '', objective: '', audience: '', tone: '', platform: 'INSTAGRAM_FEED' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: '' })); }
  function validate() {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Informe um título para identificar a solicitação.';
    if (!form.briefing.trim()) next.briefing = 'Descreva o briefing da solicitação.';
    else if (form.briefing.trim().length < 10) next.briefing = 'O briefing precisa ter ao menos 10 caracteres.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || !validate()) return;
    if (!activeWorkspaceId) { setError('Selecione um workspace antes de criar uma solicitação.'); return; }
    setLoading(true);
    setError('');
    try { await apiClient('/content-requests', { method: 'POST', body: JSON.stringify(form) }); router.push('/dashboard/content'); }
    catch (submitError) { setError(safeErrorMessage(submitError, 'Não foi possível criar a solicitação. Revise os dados e tente novamente.')); setLoading(false); }
  };

  return <>
    <PageHeader eyebrow={activeWorkspace?.name || 'Novo briefing'} title="Nova solicitação" description="Dê ao seu time todo o contexto necessário para transformar a ideia em conteúdo." actions={<button className="button button-secondary" onClick={() => router.back()}><Icon name="arrow-left" size={17} />Voltar</button>} />
    <form className="card form-card" onSubmit={handleSubmit} noValidate>
      <section className="form-section"><div className="form-section-header"><h2>Essencial</h2><p>Comece pelo nome e pelo contexto principal da solicitação.</p></div><div className="form-grid"><div className="form-span-2"><FormField id="title" label="Título" hint="Um nome curto e fácil de reconhecer." error={errors.title} count={`${form.title.length} caracteres`}><input id="title" className="input" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ex.: Lançamento da campanha de inverno" required aria-invalid={Boolean(errors.title)} aria-describedby="title-help" /></FormField></div><div className="form-span-2"><FormField id="briefing" label="Briefing" hint="Inclua contexto, mensagem principal e informações obrigatórias." error={errors.briefing} count={`${form.briefing.length} caracteres`}><textarea id="briefing" className="textarea" rows={7} value={form.briefing} onChange={(event) => update('briefing', event.target.value)} placeholder="Explique o que precisa ser comunicado, por quê e para quem..." required aria-invalid={Boolean(errors.briefing)} aria-describedby="briefing-help" /></FormField></div></div></section>
      <section className="form-section"><div className="form-section-header"><h2>Direcionamento</h2><p>Esses campos ajudam a deixar o resultado mais alinhado à estratégia.</p></div><div className="form-grid"><FormField id="objective" label="Objetivo" hint="Opcional"><input id="objective" className="input" value={form.objective} onChange={(event) => update('objective', event.target.value)} placeholder="Ex.: Gerar reconhecimento" /></FormField><FormField id="audience" label="Público-alvo" hint="Opcional"><input id="audience" className="input" value={form.audience} onChange={(event) => update('audience', event.target.value)} placeholder="Ex.: Gestores de pequenas empresas" /></FormField><div className="form-span-2"><FormField id="tone" label="Tom de voz" hint="Digite livremente ou escolha uma sugestão."><input id="tone" className="input" value={form.tone} onChange={(event) => update('tone', event.target.value)} placeholder="Ex.: Confiante e próximo" /><div className="tone-chips">{tones.map((tone) => <button className="tone-chip" type="button" key={tone} onClick={() => update('tone', tone)}>{tone}</button>)}</div></FormField></div></div></section>
      <section className="form-section"><div className="form-section-header"><h2>Plataforma</h2><p>Escolha o formato de publicação que orientará o conteúdo.</p></div><PlatformSelector value={form.platform} onChange={(value) => update('platform', value)} /></section>
      {error && <div className="notice notice-error" role="alert" style={{ margin: '0 25px 18px' }}>{error}</div>}
      <footer className="form-actions"><button className="button button-secondary" type="button" onClick={() => router.back()} disabled={loading}>Cancelar</button><button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Criando solicitação...' : <><Icon name="plus" size={17} />Criar solicitação</>}</button></footer>
    </form>
  </>;
}
