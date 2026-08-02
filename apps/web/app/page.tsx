import './components/landing/landing.css';
import { PublicHeader } from './components/landing/PublicHeader';
import { BenefitsStrip, HeroSection } from './components/landing/HeroSection';
import { AgencySection, AudienceSection, FeaturesGrid, HowItWorks, OutcomesSection, ProductShowcase } from './components/landing/CoreSections';
import { PricingSection } from './components/landing/PricingSection';
import { FAQSection } from './components/landing/FAQSection';
import { FinalCTA, PublicFooter } from './components/landing/FinalSections';

export default function Home() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Social Media IA Glauber Ads',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Plataforma para organizar briefings, conteúdos e aprovações em workspaces separados para marcas e agências.',
    featureList: ['Briefings estruturados', 'Gestão de conteúdos', 'Workspaces por marca', 'Controle de equipe', 'Status de produção'],
  };

  return <div className="lp-page"><PublicHeader /><main><HeroSection /><BenefitsStrip /><HowItWorks /><FeaturesGrid /><AgencySection /><ProductShowcase /><OutcomesSection /><PricingSection /><AudienceSection /><FAQSection /><FinalCTA /></main><PublicFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /></div>;
}
