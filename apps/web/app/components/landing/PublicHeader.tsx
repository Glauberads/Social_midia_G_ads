'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from './Visuals';

const links = [
  ['Como funciona', '#como-funciona'],
  ['Recursos', '#recursos'],
  ['Para agências', '#agencias'],
  ['Planos', '#planos'],
  ['FAQ', '#faq'],
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return <header className="lp-header"><div className="lp-container lp-header-inner"><Link href="/" className="lp-wordmark" aria-label="Social Media IA — início"><span className="lp-logo"><Icon name="sparkles" size={19} /></span><span><strong>Social Media IA</strong><small>Glauber Ads</small></span></Link><nav id="landing-navigation" className={`lp-nav ${open ? 'open' : ''}`} aria-label="Navegação da página"><div className="lp-nav-links">{links.map(([label, href]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}</div><div className="lp-nav-actions"><Link href="/login" className="button button-ghost">Entrar</Link><Link href="/cadastro" className="button button-primary">Começar agora</Link></div></nav><button className="button button-secondary icon-button lp-menu-button" onClick={() => setOpen((current) => !current)} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="landing-navigation"><Icon name={open ? 'close' : 'menu'} /></button></div></header>;
}
