'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useWorkspace } from '../components/AppShell';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, LoadingSkeleton, StatCard, StatusBadge, formatDate, formatPlatform } from '../components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface TenantContext { tenantId: string; role: string; [key: string]: string }
interface Membership { id: string; email: string; role: string; status: string }
interface Invitation { id: string; email: string; role: string; status: string; expiresAt: string }
interface ContentRequest { id: string; title: string; status: string; platform: string; createdAt: string }

export default function DashboardPage() {
  const { profile, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, refreshWorkspaces } = useWorkspace();
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [contents, setContents] = useState<ContentRequest[]>([]);
  const [newTenantName, setNewTenantName] = useState('');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState('MEMBER');
  const [lastInviteLink, setLastInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authorizedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Sessão expirada. Entre novamente.');
    return fetch(`${API_URL}${path}`, { ...options, headers: { Authorization: `Bearer ${data.session.access_token}`, ...(activeWorkspaceId ? { 'x-tenant-id': activeWorkspaceId } : {}), ...options.headers } });
  }, [activeWorkspaceId]);

  const loadMemberships = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const response = await authorizedFetch('/memberships');
    if (response.ok) setMemberships(await response.json());
  }, [activeWorkspaceId, authorizedFetch]);

  const loadInvitations = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const response = await authorizedFetch('/invitations');
    if (response.ok) setInvitations(await response.json());
  }, [activeWorkspaceId, authorizedFetch]);

  const loadDashboard = useCallback(async () => {
    if (!activeWorkspaceId) { setTenantContext(null); setContents([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    setTenantContext(null);
    setContents([]);
    setMemberships([]);
    setInvitations([]);
    try {
      const [contextResponse, contentResponse] = await Promise.all([authorizedFetch('/tenant-context'), authorizedFetch('/content-requests')]);
      if (!contextResponse.ok) throw new Error('Não foi possível carregar o contexto do workspace.');
      const context: TenantContext = await contextResponse.json();
      setTenantContext(context);
      if (!contentResponse.ok) throw new Error('Não foi possível carregar os conteúdos do workspace.');
      setContents(await contentResponse.json());
      if (context.role === 'OWNER' || context.role === 'ADMIN') await Promise.all([loadMemberships(), loadInvitations()]);
      else { setMemberships([]); setInvitations([]); }
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar o dashboard.'); }
    finally { setLoading(false); }
  }, [activeWorkspaceId, authorizedFetch, loadInvitations, loadMemberships]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const stats = useMemo(() => ({ total: contents.length, draft: contents.filter((item) => item.status === 'DRAFT').length, ready: contents.filter((item) => item.status === 'READY' || item.status === 'APPROVED').length, archived: contents.filter((item) => item.status === 'ARCHIVED').length }), [contents]);
  const canManage = tenantContext?.role === 'OWNER' || tenantContext?.role === 'ADMIN';
  const firstName = profile?.email?.split('@')[0]?.split(/[._-]/)[0] || 'criador';

  async function handleCreateTenant() {
    const name = newTenantName.trim();
    if (!name) return;
    setNotice('');
    const response = await authorizedFetch('/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }) });
    if (!response.ok) { setNotice(response.status === 409 ? 'Este nome de workspace já está em uso.' : 'Não foi possível criar o workspace.'); return; }
    const tenant = await response.json();
    await refreshWorkspaces();
    setActiveWorkspaceId(tenant.id);
    setNewTenantName('');
    setNotice('Workspace criado com sucesso.');
  }

  async function handleChangeRole(membershipId: string, role: string) {
    const response = await authorizedFetch(`/memberships/${membershipId}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    setNotice(response.ok ? 'Permissão atualizada.' : 'Não foi possível atualizar a permissão.');
    if (response.ok) loadMemberships();
  }

  async function handleChangeStatus(membershipId: string, status: string) {
    const response = await authorizedFetch(`/memberships/${membershipId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setNotice(response.ok ? 'Status do membro atualizado.' : 'Não foi possível atualizar o status.');
    if (response.ok) loadMemberships();
  }

  async function handleRemove(membershipId: string) {
    if (!window.confirm('Deseja realmente remover este membro?')) return;
    const response = await authorizedFetch(`/memberships/${membershipId}`, { method: 'DELETE' });
    setNotice(response.ok ? 'Membro removido.' : 'Não foi possível remover o membro.');
    if (response.ok) loadMemberships();
  }

  async function handleInvite() {
    if (!newInviteEmail.trim()) return;
    const response = await authorizedFetch('/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newInviteEmail.trim(), role: newInviteRole }) });
    if (!response.ok) { setNotice(response.status === 409 ? 'Já existe um convite pendente para este e-mail.' : 'Não foi possível criar o convite.'); return; }
    const invite = await response.json();
    if (invite.rawToken) setLastInviteLink(`${window.location.origin}/convite/aceitar?token=${invite.rawToken}`);
    setNewInviteEmail('');
    setNotice('Convite criado com sucesso.');
    loadInvitations();
  }

  async function handleRevokeInvite(id: string) {
    if (!window.confirm('Deseja revogar este convite?')) return;
    const response = await authorizedFetch(`/invitations/${id}`, { method: 'DELETE' });
    setNotice(response.ok ? 'Convite revogado.' : 'Não foi possível revogar o convite.');
    if (response.ok) loadInvitations();
  }

  if (loading) return <><div className="skeleton" style={{ height: 190, marginBottom: 20 }} /><LoadingSkeleton rows={4} /></>;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  return <>
    <section className="welcome-panel">
      <div className="welcome-copy"><span>{activeWorkspace?.name || 'Seu workspace'}</span><h1>Olá, {firstName}. Vamos criar algo relevante hoje?</h1><p>Acompanhe seus briefings e mantenha a produção de conteúdo fluindo com clareza.</p></div>
      <Link href="/dashboard/content/new" className="button"><Icon name="plus" size={18} />Criar conteúdo</Link>
    </section>

    {!activeWorkspaceId ? <section className="section"><EmptyState icon="workspace" title="Crie seu primeiro workspace" description="Você precisa de um workspace para organizar solicitações, equipe e conteúdo." action={<a href="#configuracoes" className="button button-primary">Configurar workspace</a>} /></section> : <>
      <section className="stats-grid section" aria-label="Resumo das solicitações"><StatCard label="Total de solicitações" value={stats.total} note="Todos os conteúdos do workspace" icon="content" tone="purple" /><StatCard label="Rascunhos" value={stats.draft} note="Briefings ainda em construção" icon="edit" tone="blue" /><StatCard label="Prontas" value={stats.ready} note="Prontas ou aprovadas" icon="check" tone="green" /><StatCard label="Arquivadas" value={stats.archived} note="Itens fora do fluxo ativo" icon="archive" tone="gray" /></section>

      <section className="section"><div className="section-header"><div><h2 className="section-title">Conteúdos recentes</h2><p className="section-description">As últimas solicitações do workspace ativo.</p></div><Link href="/dashboard/content" className="text-link">Ver todos</Link></div>{contents.length === 0 ? <EmptyState title="Seu calendário começa com um briefing" description="Crie a primeira solicitação para iniciar o fluxo editorial do workspace." action={<Link href="/dashboard/content/new" className="button button-primary"><Icon name="plus" size={17} />Nova solicitação</Link>} /> : <div className="content-list">{contents.slice(0, 4).map((item) => <Link href={`/dashboard/content/${item.id}`} className="content-row" key={item.id}><div className="content-title"><strong>{item.title}</strong><span>Criado em {formatDate(item.createdAt)}</span></div><span className="platform"><Icon name="instagram" size={16} />{formatPlatform(item.platform)}</span><span className="content-status"><StatusBadge status={item.status} /></span><span className="content-date">{formatDate(item.createdAt)}</span><span className="row-action"><Icon name="arrow-right" size={18} /></span></Link>)}</div>}</section>

      <section className="section"><div className="section-header"><div><h2 className="section-title">Como o fluxo funciona</h2><p className="section-description">Uma visão simples das etapas do processo editorial.</p></div></div><div className="card flow-grid"><div className="flow-step"><div className="flow-number">1</div><h3>Criar briefing</h3><p>Registre contexto, objetivo e público.</p></div><div className="flow-step"><div className="flow-number">2</div><h3>Revisar conteúdo</h3><p>Valide se a solicitação está completa.</p></div><div className="flow-step"><div className="flow-number">3</div><h3>Aprovar</h3><p>Alinhe o material com o time.</p></div><div className="flow-step"><div className="flow-number">4</div><h3>Publicar futuramente</h3><p>Etapa planejada para próximos ciclos.</p></div></div></section>
    </>}

    <section className="section" id="equipe"><div className="section-header"><div><h2 className="section-title">Equipe</h2><p className="section-description">Gerencie acessos e convites do workspace.</p></div>{tenantContext && <StatusBadge status={tenantContext.role} />}</div>{!canManage ? <div className="notice notice-info">Seu perfil pode visualizar o workspace, mas apenas Owner e Admin gerenciam equipe e convites.</div> : <div className="dashboard-columns"><div className="card"><div className="card-body"><h3 className="section-title">Membros</h3><div className="table-scroll" style={{ marginTop: 15 }}><table className="data-table"><thead><tr><th>E-mail</th><th>Permissão</th><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{memberships.map((member) => <tr key={member.id}><td>{member.email}</td><td><select className="select" value={member.role} onChange={(event) => handleChangeRole(member.id, event.target.value)}><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MEMBER">Membro</option><option value="VIEWER">Leitor</option></select></td><td><select className="select" value={member.status} onChange={(event) => handleChangeStatus(member.id, event.target.value)}><option value="ACTIVE">Ativo</option><option value="SUSPENDED">Suspenso</option></select></td><td><button className="button button-danger button-sm icon-button" onClick={() => handleRemove(member.id)} aria-label={`Remover ${member.email}`}><Icon name="trash" size={16} /></button></td></tr>)}</tbody></table></div>{memberships.length === 0 && <p className="section-description">Nenhum membro disponível.</p>}</div></div><div className="card"><div className="card-body"><h3 className="section-title">Convidar pessoa</h3><p className="section-description">Envie um acesso com a permissão adequada.</p><div className="field" style={{ marginTop: 16 }}><label className="field-label" htmlFor="invite-email">E-mail</label><input id="invite-email" className="input" type="email" value={newInviteEmail} onChange={(event) => setNewInviteEmail(event.target.value)} placeholder="pessoa@empresa.com" /></div><div className="field" style={{ marginTop: 12 }}><label className="field-label" htmlFor="invite-role">Permissão</label><select id="invite-role" className="select" value={newInviteRole} onChange={(event) => setNewInviteRole(event.target.value)}><option value="ADMIN">Admin</option><option value="MEMBER">Membro</option><option value="VIEWER">Leitor</option></select></div><button className="button button-primary" onClick={handleInvite} style={{ width: '100%', marginTop: 15 }}><Icon name="send" size={16} />Enviar convite</button></div></div></div>}{canManage && invitations.length > 0 && <div className="card section"><div className="card-body"><h3 className="section-title">Convites pendentes</h3><div className="table-scroll" style={{ marginTop: 15 }}><table className="data-table"><thead><tr><th>E-mail</th><th>Permissão</th><th>Status</th><th>Expira em</th><th></th></tr></thead><tbody>{invitations.map((invite) => <tr key={invite.id}><td>{invite.email}</td><td>{invite.role}</td><td><StatusBadge status={invite.status} /></td><td>{formatDate(invite.expiresAt)}</td><td>{invite.status === 'PENDING' && <button className="button button-danger button-sm" onClick={() => handleRevokeInvite(invite.id)}>Revogar</button>}</td></tr>)}</tbody></table></div></div></div>}{lastInviteLink && <div className="notice notice-info section"><strong>Link local do convite:</strong> <a className="text-link" href={lastInviteLink} target="_blank" rel="noreferrer">Abrir convite <Icon name="external" size={13} /></a></div>}</section>

    <section className="section" id="configuracoes"><div className="section-header"><div><h2 className="section-title">Configurações do workspace</h2><p className="section-description">Crie um novo espaço para outra marca ou equipe.</p></div></div><div className="card workspace-card"><div className="inline-form"><label className="sr-only" htmlFor="workspace-name">Nome do novo workspace</label><input id="workspace-name" className="input" value={newTenantName} onChange={(event) => setNewTenantName(event.target.value)} placeholder="Nome do novo workspace" /><button className="button button-primary" onClick={handleCreateTenant}><Icon name="plus" size={17} />Criar workspace</button></div>{notice && <div className={`notice ${notice.includes('sucesso') || notice.includes('atualizad') || notice.includes('removido') || notice.includes('revogado') ? 'notice-success' : 'notice-error'}`} role="status" style={{ marginTop: 14 }}>{notice}</div>}</div></section>
  </>;
}
