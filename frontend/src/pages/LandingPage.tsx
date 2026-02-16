import { HeroBanner } from '../components/landing/HeroBanner';
import { LandingContent } from '../components/landing/LandingContent';
import { SiteFooter } from '../components/landing/SiteFooter';

export default function LandingPage() {
  return (
    <>
      <HeroBanner />
      <LandingContent />
      <SiteFooter />
    </>
  );
}
