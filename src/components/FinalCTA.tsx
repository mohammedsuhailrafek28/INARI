import React from 'react';
import { ArrowRight, Terminal } from 'lucide-react';
import { Section } from './ui/Section';
import { Button } from './ui/Button';

export const FinalCTA: React.FC = () => {
  const scrollToPreview = () => {
    const el = document.getElementById('preview');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Section canvas="dark" className="border-t border-border-dark pt-20 md:pt-32 pb-24 md:pb-36">
      {/* Eyebrow */}
      <div className="flex items-center gap-3 font-mono text-xs md:text-sm tracking-wideMono uppercase text-ink-mutedLight mb-8">
        <span className="w-2.5 h-2.5 bg-thread" />
        <span>06 // READY TO MODEL</span>
      </div>

      {/* Mammoth Headline */}
      <div className="max-w-5xl">
        <h2 className="font-archivo font-[850] text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.88] tracking-tightest uppercase text-ink-light">
          HAVE A <br />
          FINANCIAL WHAT-IF <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-thread via-thread to-gold-light">
            WORTH MODELING?
          </span>
        </h2>

        <p className="mt-8 font-sans text-xl sm:text-2xl text-ink-mutedLight max-w-2xl leading-relaxed">
          Stop staring at static category pie charts. Ingest your bank statements and watch your living money model adapt to your ambitions.
        </p>

        {/* Action Button & Terminal Launcher */}
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Button
            variant="vermilion"
            size="lg"
            onClick={() => { window.location.href = '/dashboard'; }}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Open Web Dashboard
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={scrollToPreview}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Explore Interactive Demo
          </Button>

          <div className="flex items-center gap-3 font-mono text-xs text-ink-mutedLight bg-canvas-card px-4 py-3.5 border border-border-dark">
            <Terminal className="w-4 h-4 text-thread" />
            <span>CLI READY:</span>
            <code className="text-ink-light">pip install inari-coach</code>
          </div>
        </div>

        {/* Quick Launch Commands */}
        <div className="mt-16 pt-8 border-t border-border-dark grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono text-xs">
          <div className="p-4 bg-canvas-card border border-border-dark">
            <span className="text-thread block mb-1">01 / INGESTION</span>
            <span className="text-ink-mutedLight">inari ingest --file statement.pdf</span>
          </div>
          <div className="p-4 bg-canvas-card border border-border-dark">
            <span className="text-gold-light block mb-1">02 / SCENARIO</span>
            <span className="text-ink-mutedLight">inari plan --scenario dining-30</span>
          </div>
          <div className="p-4 bg-canvas-card border border-border-dark">
            <span className="text-emerald block mb-1">03 / AUDIT</span>
            <span className="text-ink-mutedLight">inari review --month 2026-10</span>
          </div>
        </div>
      </div>
    </Section>
  );
};

