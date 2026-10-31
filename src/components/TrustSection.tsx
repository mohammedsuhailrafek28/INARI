import React from 'react';
import { ShieldAlert, Cpu, Lock, CheckCircle2 } from 'lucide-react';
import { Section } from './ui/Section';

export const TrustSection: React.FC = () => {
  const pillars = [
    {
      icon: <ShieldAlert className="w-6 h-6 text-thread" />,
      title: 'ZERO SECURITIES RECOMMENDATIONS',
      text: 'INARI is built for educational modeling only. We will never recommend individual stocks, pitch mutual funds, promote credit cards, or speculate on cryptocurrency. We earn zero kickbacks and carry zero broker relationships.',
    },
    {
      icon: <Cpu className="w-6 h-6 text-thread" />,
      title: 'DETERMINISTIC PYTHON MATH',
      text: 'Every projection, goal arrival date, and emergency runway calculation is computed by deterministic Python code. No large language models calculate your account balance or guess compound timelines.',
    },
    {
      icon: <Lock className="w-6 h-6 text-thread" />,
      title: 'LOCAL & SOVEREIGN DATA',
      text: 'Your bank statements (PDF, CSV, SMS) are parsed locally within your instance. Every profile modification is saved as an immutable local version that you can inspect, audit, or roll back at any time.',
    },
  ];

  return (
    <Section id="ethics" canvas="light" className="border-t border-border-light">
      {/* Eyebrow */}
      <div className="flex items-center gap-3 font-mono text-xs md:text-sm tracking-wideMono uppercase text-ink-mutedDark mb-6">
        <span className="w-2.5 h-2.5 bg-ink-dark" />
        <span>04 // ETHICS & COMPLIANCE MANDATE</span>
      </div>

      {/* Mammoth Headline */}
      <div className="max-w-4xl mb-16 md:mb-24">
        <h2 className="font-archivo font-[800] text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.88] tracking-tightest uppercase text-ink-dark">
          EVERY RUPEE <br />
          CARRIES A <br />
          HUMAN CHOICE.
        </h2>
        <p className="mt-8 font-sans text-xl md:text-2xl text-ink-mutedDark max-w-2xl leading-relaxed">
          Traditional personal finance apps commodify your attention and sell high-fee investment products. INARI is engineered on radical transparency.
        </p>
      </div>

      {/* 3 Pillars of Trust Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-border-light">
        {pillars.map((pillar, idx) => (
          <div
            key={idx}
            className="p-8 bg-canvas-lightCard border border-border-light flex flex-col justify-between"
          >
            <div>
              <div className="mb-6 p-3 bg-white/70 border border-black/10 inline-block">
                {pillar.icon}
              </div>
              <h3 className="font-archivo font-bold text-xl md:text-2xl text-ink-dark uppercase tracking-tight mb-4">
                {pillar.title}
              </h3>
              <p className="font-sans text-base text-ink-mutedDark leading-relaxed">
                {pillar.text}
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-black/10 flex items-center gap-2 font-mono text-xs text-ink-dark font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald" />
              <span>GUARANTEED BY DESIGN</span>
            </div>
          </div>
        ))}
      </div>

      {/* Educational Notice Banner */}
      <div className="mt-16 p-8 bg-black text-white font-mono text-xs leading-relaxed border border-border-dark flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <span className="text-thread font-bold uppercase tracking-widest block mb-1">
            STATUTORY EDUCATIONAL NOTICE //
          </span>
          <span className="text-white/80">
            INARI is an educational financial scenario simulation system. It does not provide certified investment advice, tax consulting, or brokerage solicitation. All projected timelines are mathematical models.
          </span>
        </div>
        <div className="whitespace-nowrap px-4 py-2 border border-white/20 text-white/90 text-[11px] uppercase tracking-wider">
          NON-ADVISORY SYSTEM
        </div>
      </div>
    </Section>
  );
};

