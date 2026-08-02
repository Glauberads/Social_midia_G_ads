import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function AuthShell({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return <main className="auth-page"><section className="auth-visual" aria-label="Sobre o Social Media IA"><Link href="/" className="auth-brand"><span className="brand-mark"><Icon name="sparkles" size={20} /></span><span>Social Media IA</span></Link><div className="auth-copy"><h1>{title}</h1><p>{description}</p></div><div className="auth-feature-list"><span className="auth-feature"><Icon name="check" size={15} />Briefings organizados</span><span className="auth-feature"><Icon name="check" size={15} />Fluxo em equipe</span><span className="auth-feature"><Icon name="check" size={15} />Visão por workspace</span></div></section><section className="auth-panel">{children}</section></main>;
}
