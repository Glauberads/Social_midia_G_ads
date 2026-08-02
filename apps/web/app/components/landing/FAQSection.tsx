'use client';

import { useState } from 'react';
import { Icon } from './Visuals';

const faqs = [
  ['O que é o Social Media IA?', 'É uma plataforma para organizar briefings, solicitações e o fluxo de conteúdo de marcas e agências em workspaces separados.'],
  ['A IA já está disponível?', 'Ainda não. A integração de IA generativa está planejada e será apresentada como recurso futuro até estar efetivamente disponível.'],
  ['Posso gerenciar mais de uma marca?', 'Sim. A estrutura multi-tenant permite separar marcas e clientes por workspace, mantendo contexto, equipe e dados organizados.'],
  ['O sistema publica diretamente no Instagram?', 'Ainda não. A publicação e a integração direta com Instagram fazem parte do fluxo planejado para uma etapa futura.'],
  ['Posso trabalhar com minha equipe?', 'Sim. O produto já possui estrutura de membros, convites, papéis e permissões por workspace.'],
  ['Como funciona a aprovação de conteúdo?', 'A plataforma organiza solicitações e status para apoiar revisão e decisões. O fluxo de aprovação será ampliado nas próximas etapas do produto.'],
  ['Meus dados ficam separados de outros clientes?', 'Sim. A arquitetura utiliza isolamento por workspace, políticas de acesso e controles de permissão para separar os contextos.'],
  ['Preciso instalar alguma coisa?', 'Não para usar a versão web. No ambiente atual, a plataforma pode ser executada localmente conforme a configuração do projeto.'],
  ['Existe integração com WhatsApp?', 'Ainda não. A entrada de briefings e automações via WhatsApp estão previstas como integração futura.'],
  ['Posso cancelar quando quiser?', 'Os planos comerciais e as regras de contratação ainda estão em definição. Essas condições serão publicadas antes da oferta comercial.'],
];

export function FAQSection() {
  const [open, setOpen] = useState(0);
  return <section className="lp-section lp-faq-section" id="faq"><div className="lp-container lp-faq-layout"><div className="lp-faq-intro"><span className="lp-section-tag">FAQ</span><h2>Perguntas frequentes.</h2><p>Respostas diretas sobre o que já está disponível e o que ainda está no roadmap.</p></div><div className="lp-faq-list">{faqs.map(([question, answer], index) => { const expanded = open === index; return <article className={`lp-faq-item ${expanded ? 'open' : ''}`} key={question}><button onClick={() => setOpen(expanded ? -1 : index)} aria-expanded={expanded} aria-controls={`faq-answer-${index}`}><span>{question}</span><Icon name="chevron-down" size={18} /></button><div id={`faq-answer-${index}`} className="lp-faq-answer" hidden={!expanded}><p>{answer}</p></div></article>; })}</div></div></section>;
}
