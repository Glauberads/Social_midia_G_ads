'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { useWorkspace } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, StatusBadge, formatDate, formatPlatform, safeErrorMessage } from '../../components/ui';

interface ContentRequest { id: string; title: string; platform: string; status: string; createdAt: string; createdByEmail?: string; createdBy?: { email?: string } }

export default function ContentListPage() {
  const { activeWorkspaceId } = useWorkspace();
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const load = useCallback(async () => {
    if (!activeWorkspaceId) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    setRequests([]);
    try { setRequests(await apiClient('/content-requests')); }
    catch (loadError) { setError(safeErrorMessage(loadError, 'Não foi possível carregar as solicitações. Tente novamente.')); }
    finally { setLoading(false); }
  }, [activeWorkspaceId]);

  useEffect(() => { load(); }, [load]);

  const statuses = useMemo(() => Array.from(new Set(requests.map((request) => request.status))), [requests]);
  const filtered = useMemo(() => requests.filter((request) => request.title.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')) && (status === 'ALL' || request.status === status)), [requests, search, status]);

  return <>
    <PageHeader eyebrow="Biblioteca de conteúdo" title="Solicitações de conteúdo" description="Encontre, filtre e acompanhe todos os briefings do workspace ativo." actions={<Link href="/dashboard/content/new" className="button button-primary"><Icon name="plus" size={17} />Nova solicitação</Link>} />
    {!activeWorkspaceId ? <EmptyState icon="workspace" title="Selecione um workspace" description="Escolha ou crie um workspace para visualizar suas solicitações." action={<Link href="/dashboard#configuracoes" className="button button-primary">Ir para configurações</Link>} /> : <>
      <div className="toolbar"><div className="toolbar-group"><div className="search-wrap"><Icon name="search" size={17} /><label className="sr-only" htmlFor="content-search">Buscar por título</label><input id="content-search" className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título..." /></div><label className="sr-only" htmlFor="status-filter">Filtrar por status</label><select id="status-filter" className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Todos os status</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><span className="result-count">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span></div>
      {loading ? <LoadingSkeleton rows={5} /> : error ? <ErrorState message={error} onRetry={load} /> : requests.length === 0 ? <EmptyState title="Nenhuma solicitação por aqui" description="Crie o primeiro briefing do workspace para começar seu fluxo editorial." action={<Link href="/dashboard/content/new" className="button button-primary"><Icon name="plus" size={17} />Criar solicitação</Link>} /> : filtered.length === 0 ? <EmptyState icon="search" title="Nenhum resultado encontrado" description="Tente ajustar o termo de busca ou o filtro de status." action={<button className="button button-secondary" onClick={() => { setSearch(''); setStatus('ALL'); }}>Limpar filtros</button>} /> : <div className="content-list">{filtered.map((request) => <article className="content-row" key={request.id}><div className="content-title"><strong>{request.title}</strong><span>{request.createdBy?.email || request.createdByEmail ? `Por ${request.createdBy?.email || request.createdByEmail}` : `Criado em ${formatDate(request.createdAt)}`}</span></div><span className="platform"><Icon name="instagram" size={16} />{formatPlatform(request.platform)}</span><span className="content-status"><StatusBadge status={request.status} /></span><span className="content-date">{formatDate(request.createdAt)}</span><details className="action-menu"><summary className="button button-ghost icon-button button-sm" aria-label={`Ações de ${request.title}`}><Icon name="more" size={18} /></summary><div className="action-menu-popover"><Link href={`/dashboard/content/${request.id}`}><Icon name="eye" size={15} />Ver detalhes</Link></div></details></article>)}</div>}
    </>}
  </>;
}
