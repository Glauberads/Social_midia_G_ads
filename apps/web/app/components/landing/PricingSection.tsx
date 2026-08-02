import Link from 'next/link';
import { Icon } from './Visuals';

const plans = [
  { name: 'Starter', tag: 'Para começar', description: 'A base essencial para organizar o conteúdo de uma marca.', features: ['Uma marca', 'Fluxo básico de conteúdo', 'Conteúdos limitados', 'Suporte padrão'], cta: 'Entrar na lista', href: '/cadastro' },
  { name: 'Pro', tag: 'Mais escolhido', description: 'Para operações que precisam de equipe e mais capacidade.', features: ['Múltiplas marcas', 'Gestão de equipe', 'Mais conteúdos', 'Recursos avançados'], cta: 'Começar agora', href: '/cadastro', featured: true },
  { name: 'Agência', tag: 'Operação ampliada', description: 'Para gerenciar múltiplos clientes em uma visão centralizada.', features: ['Múltiplos clientes', 'Equipe ampliada', 'Gestão centralizada', 'Suporte prioritário'], cta: 'Fale conosco', href: '#contato' },
];

export function PricingSection() {
  return <section className="lp-section" id="planos"><div className="lp-container"><div className="lp-section-head"><span className="lp-section-tag">Planos</span><h2>Uma estrutura pronta para crescer com sua operação.</h2><p>A precificação ainda está em definição. Escolha o perfil que mais se aproxima da sua necessidade.</p></div><div className="lp-pricing-grid">{plans.map((plan) => <article className={`lp-price-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>{plan.featured && <span className="lp-plan-ribbon">Recomendado</span>}<span className="lp-plan-tag">{plan.tag}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="lp-price-status">Preço em definição <small>Em breve</small></div><ul>{plan.features.map((feature) => <li key={feature}><Icon name="check" size={15} />{feature}</li>)}</ul><Link href={plan.href} className={`button ${plan.featured ? 'button-primary' : 'button-secondary'}`}>{plan.cta} <Icon name="arrow-right" size={16} /></Link></article>)}</div></div></section>;
}
