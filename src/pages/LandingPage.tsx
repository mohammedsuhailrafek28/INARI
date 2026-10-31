import React from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { HowItWorks } from '../components/HowItWorks';
import { Capabilities } from '../components/Capabilities';
import { LivingWorlds } from '../components/LivingWorlds';
import { ProductPreview } from '../components/ProductPreview';
import { TrustSection } from '../components/TrustSection';
import { FAQ } from '../components/FAQ';
import { FinalCTA } from '../components/FinalCTA';
import { Footer } from '../components/Footer';

export const LandingPage: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-canvas-dark text-ink-light selection:bg-thread selection:text-white">
      {/* Global Inverting Site Navigation */}
      <Navbar />

      {/* Main Structural Flow */}
      <main id="main-content">
        {/* Section 01: Hero Scene */}
        <Hero />

        {/* Section 02: Selected Work / Architectural Pipeline */}
        <HowItWorks />

        {/* Section 03: Capabilities Matrix */}
        <Capabilities />

        {/* Section 04: The 6 Living Worlds */}
        <LivingWorlds />

        {/* Section 05: Interactive Product Preview Dashboard */}
        <ProductPreview />

        {/* Section 06: Trust, Ethics & Compliance */}
        <TrustSection />

        {/* Section 07: Frequently Asked Questions */}
        <FAQ />

        {/* Section 08: Terminal Finale */}
        <FinalCTA />
      </main>

      {/* Global Colophon Footer */}
      <Footer />
    </div>
  );
};
