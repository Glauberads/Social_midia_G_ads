import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Social Media IA | Organize, aprove e publique conteúdos',
  description: 'Organize briefings, conteúdos e aprovações em um fluxo centralizado para sua marca ou agência.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Social Media IA | Do briefing à publicação',
    description: 'Organize briefings, conteúdos e aprovações em um fluxo centralizado para sua marca ou agência.',
    url: '/',
    siteName: 'Social Media IA Glauber Ads',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Social Media IA | Do briefing à publicação',
    description: 'Organize briefings, conteúdos e aprovações em um fluxo centralizado para sua marca ou agência.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
