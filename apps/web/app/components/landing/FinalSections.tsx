import Link from 'next/link';
import { Icon } from './Visuals';

export function FinalCTA() {
  return <section className="lp-final-section"><div className="lp-container"><div className="lp-final-card"><div className="lp-final-orbit"><Icon name="sparkles" size={24} /></div><span className="lp-section-tag">Comece pelo primeiro briefing</span><h2>Organize hoje o processo que sua equipe ainda controla por mensagens e planilhas.</h2><p>Crie seu workspace, registre seu primeiro briefing e acompanhe todo o fluxo em um só lugar.</p><div><Link href="/cadastro" className="button button-primary">Começar agora <Icon name="arrow-right" size={17} /></Link><Link href="/login" className="button button-secondary">Entrar na plataforma</Link></div><small>Recursos de IA, WhatsApp e publicação estão em desenvolvimento.</small></div></div></section>;
}

export function PublicFooter() {
  return <footer className="lp-footer" id="contato"><div className="lp-container"><div className="lp-footer-main"><div className="lp-footer-brand"><span className="lp-logo"><Icon name="sparkles" size={19} /></span><strong>Social Media IA</strong><p>Briefings, conteúdos e colaboração organizados em um fluxo por workspace.</p></div><div className="lp-footer-column"><strong>Produto</strong><a href="#como-funciona">Como funciona</a><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#faq">FAQ</a></div><div className="lp-footer-column"><strong>Acesso</strong><Link href="/login">Entrar</Link><Link href="/cadastro">Criar conta</Link><Link href="/dashboard">Ir para o painel</Link></div><div className="lp-footer-column"><strong>Informações</strong><span>Termos — em preparação</span><span>Privacidade — em preparação</span><span>Contato — canal em definição</span></div></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} Social Media IA Glauber Ads.</span><span><i />Produto em desenvolvimento ativo</span></div></div></footer>;
}
