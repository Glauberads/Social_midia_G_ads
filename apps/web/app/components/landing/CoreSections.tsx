import Link from 'next/link';
import { Icon, type IconName, StatusBadge } from './Visuals';

const steps: Array<[IconName, string, string, string]> = [
  ['brief', '01', 'Envie o briefing', 'Registre título, objetivo, público, tom e plataforma em um formato claro.'],
  ['content', '02', 'Organize o conteúdo', 'Acompanhe rascunhos, revisões e status sem perder contexto em conversas.'],
  ['check', '03', 'Revise e aprove', 'Centralize decisões e mantenha cada solicitação visível para a equipe.'],
  ['calendar', '04', 'Publique com consistência', 'O fluxo de publicação automática está planejado para uma etapa futura.'],
];

export function HowItWorks() {
  return <section className="lp-section" id="como-funciona"><div className="lp-container"><div className="lp-section-head"><span className="lp-section-tag">Como funciona</span><h2>Um processo claro, do pedido à aprovação.</h2><p>Quatro etapas para trocar improviso por uma rotina editorial previsível.</p></div><div className="lp-steps">{steps.map(([icon, number, title, text]) => <article className="lp-step" key={number}><div className="lp-step-icon"><Icon name={icon} size={21} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div><div className="lp-flow-line"><span>Briefing</span><Icon name="arrow-right" size={16} /><span>Conteúdo</span><Icon name="arrow-right" size={16} /><span>Aprovação</span><Icon name="arrow-right" size={16} /><span>Publicação <small>futura</small></span></div><div className="lp-center-action"><Link href="/cadastro" className="button button-primary">Começar agora <Icon name="arrow-right" size={17} /></Link></div></div></section>;
}

const features: Array<[IconName, string, string, boolean?]> = [
  ['brief', 'Briefings estruturados', 'Contexto, objetivo, público, tom e plataforma reunidos em uma única solicitação.'],
  ['content', 'Gestão de conteúdos', 'Visualize solicitações e encontre rapidamente o que precisa de atenção.'],
  ['clock', 'Status de produção', 'Acompanhe o estágio de cada conteúdo com uma linguagem visual simples.'],
  ['workspace', 'Isolamento por workspace', 'Separe marcas e clientes para manter cada operação no contexto correto.'],
  ['team', 'Controle de equipe', 'Organize participantes e permissões dentro de cada workspace.'],
  ['archive', 'Histórico e auditoria', 'Mantenha rastreabilidade e uma base segura para decisões do time.'],
  ['check', 'Aprovação organizada', 'Estruture o fluxo de revisão e prepare a operação para aprovações centralizadas.'],
  ['gear', 'Segurança multi-tenant', 'Dados isolados por workspace e controles de acesso aplicados na plataforma.'],
  ['sparkles', 'IA generativa', 'Geração assistida de conteúdo conectada ao briefing.', true],
  ['mail', 'WhatsApp', 'Entrada de briefings e acompanhamento por mensagens.', true],
  ['instagram', 'Instagram', 'Publicação conectada aos canais da marca.', true],
  ['calendar', 'Agendamento', 'Calendário e automação das próximas publicações.', true],
];

export function FeaturesGrid() {
  return <section className="lp-section lp-section-tint" id="recursos"><div className="lp-container"><div className="lp-section-head"><span className="lp-section-tag">Recursos</span><h2>O que sua operação precisa para trabalhar com clareza.</h2><p>Recursos atuais e uma base preparada para evoluir, sem confundir o que já existe com o que vem depois.</p></div><div className="lp-feature-grid">{features.map(([icon, title, text, future]) => <article className={`lp-feature-card ${future ? 'future' : ''}`} key={title}><div className="lp-feature-icon"><Icon name={icon} size={20} /></div>{future && <span className="lp-coming">Em breve</span>}<h3>{title}</h3><p>{text}</p></article>)}</div></div></section>;
}

export function AgencySection() {
  return <section className="lp-section" id="agencias"><div className="lp-container lp-agency-grid"><div className="lp-agency-copy"><span className="lp-section-tag">Para agências</span><h2>Feito para quem gerencia mais de uma marca.</h2><p>Separe clientes por workspace, organize equipes e mantenha todos os briefings dentro de um processo consistente.</p><ul><li><Icon name="check" size={16} />Clientes e marcas em contextos separados</li><li><Icon name="check" size={16} />Equipes e permissões por workspace</li><li><Icon name="check" size={16} />Menos retrabalho entre atendimento e produção</li><li><Icon name="check" size={16} />Status visíveis para padronizar o processo</li></ul><Link href="/cadastro" className="button button-primary">Começar agora <Icon name="arrow-right" size={17} /></Link></div><div className="lp-workspace-visual" aria-label="Exemplo de múltiplos workspaces"><div className="lp-workspace-window"><div className="lp-window-top"><span /><span /><span /><small>Seus workspaces</small></div><div className="lp-workspace-list"><div className="selected"><i className="brand-a">A</i><p><strong>Aurora Studio</strong><small>8 solicitações ativas</small></p><StatusBadge status="READY" /></div><div><i className="brand-b">N</i><p><strong>Norte Café</strong><small>3 solicitações ativas</small></p><StatusBadge status="DRAFT" /></div><div><i className="brand-c">V</i><p><strong>Vértice Fit</strong><small>5 solicitações ativas</small></p><StatusBadge status="APPROVED" /></div></div><div className="lp-workspace-summary"><span><strong>3</strong> marcas organizadas</span><span><strong>1</strong> operação centralizada</span></div></div></div></div></section>;
}

export function ProductShowcase() {
  return <section className="lp-section lp-showcase"><div className="lp-container"><div className="lp-section-head lp-head-light"><span className="lp-section-tag">Produto em ação</span><h2>Uma visão única para briefing, conteúdo e equipe.</h2><p>Mockups fiéis à experiência atual, sem dados reais de usuários ou clientes.</p></div><div className="lp-showcase-window"><div className="lp-showcase-bar"><div className="lp-window-dots"><i /><i /><i /></div><div className="lp-showcase-tabs"><span className="active">Visão geral</span><span>Conteúdos</span><span>Nova solicitação</span></div><span className="lp-demo-label">Demonstração</span></div><div className="lp-showcase-body"><aside><div className="lp-showcase-brand"><Icon name="sparkles" size={16} /></div><span className="active"><Icon name="dashboard" size={17} /></span><span><Icon name="content" size={17} /></span><span><Icon name="plus" size={17} /></span><span><Icon name="team" size={17} /></span></aside><div className="lp-showcase-content"><div className="lp-demo-title"><div><small>Marca Aurora</small><strong>Visão geral</strong></div><button><Icon name="plus" size={14} />Criar conteúdo</button></div><div className="lp-demo-stats"><div><small>Total</small><strong>12</strong></div><div><small>Rascunhos</small><strong>4</strong></div><div><small>Prontos</small><strong>5</strong></div><div><small>Arquivados</small><strong>3</strong></div></div><div className="lp-demo-table"><div className="heading"><span>Solicitação</span><span>Plataforma</span><span>Status</span></div><div><p><strong>Campanha de lançamento</strong><small>Atualizado hoje</small></p><span>Instagram Feed</span><StatusBadge status="READY" /></div><div><p><strong>Série bastidores da marca</strong><small>Atualizado ontem</small></p><span>Instagram Reel</span><StatusBadge status="DRAFT" /></div><div><p><strong>Calendário institucional</strong><small>Atualizado há 3 dias</small></p><span>Instagram Story</span><StatusBadge status="APPROVED" /></div></div></div></div></div></div></section>;
}

const outcomes = [['sparkles', 'Produza com consistência', 'Use o mesmo processo em todas as solicitações.'], ['edit', 'Reduza retrabalho', 'Briefings completos evitam idas e voltas desnecessárias.'], ['check', 'Centralize decisões', 'Mantenha revisão e contexto no lugar certo.'], ['eye', 'Ganhe visibilidade', 'Saiba o que está em rascunho, pronto ou arquivado.'], ['team', 'Organize equipes e clientes', 'Separe responsabilidades por workspace.'], ['gear', 'Prepare-se para automação', 'Construa agora a base para integrações futuras.']] as const;
export function OutcomesSection() {
  return <section className="lp-section"><div className="lp-container"><div className="lp-section-head"><span className="lp-section-tag">Resultados operacionais</span><h2>Menos ruído. Mais clareza para produzir.</h2></div><div className="lp-outcome-grid">{outcomes.map(([icon, title, text]) => <article key={title}><Icon name={icon} size={19} /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div><div className="lp-trust-panel"><div><Icon name="workspace" size={22} /><span><strong>Fluxo centralizado</strong><small>Uma fonte única de contexto</small></span></div><div><Icon name="layout" size={22} /><span><strong>Isolamento por workspace</strong><small>Cada marca no lugar certo</small></span></div><div><Icon name="team" size={22} /><span><strong>Acesso controlado</strong><small>Papéis e permissões por equipe</small></span></div><div><Icon name="archive" size={22} /><span><strong>Histórico auditável</strong><small>Base preparada para rastreabilidade</small></span></div></div></div></section>;
}

const audiences = [['workspace', 'Pequenos negócios'], ['user', 'Social media'], ['team', 'Agências'], ['layout', 'Equipes de marketing'], ['sparkles', 'Criadores'], ['gear', 'Franquias']] as const;
export function AudienceSection() {
  return <section className="lp-section lp-section-tint"><div className="lp-container"><div className="lp-section-head"><span className="lp-section-tag">Para quem foi criado</span><h2>Um fluxo que se adapta a diferentes operações.</h2><p>Da primeira marca a uma carteira inteira de clientes.</p></div><div className="lp-audience-grid">{audiences.map(([icon, label]) => <article key={label}><Icon name={icon} size={23} /><strong>{label}</strong></article>)}</div></div></section>;
}
