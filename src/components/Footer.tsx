import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#030303] text-ink-light border-t border-border-dark py-16 px-4 sm:px-6 md:px-10 lg:px-12">
      <div className="w-full max-w-[1360px] mx-auto flex flex-col gap-12">
        {/* Top Footer Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-border-dark">
          {/* Logo & Brand Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 text-thread flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            </div>
            <span className="font-serif font-bold text-2xl tracking-[0.15em] uppercase text-white">
              INARI
            </span>
            <span className="font-mono text-xs text-ink-mutedLight uppercase ml-3 border-l border-border-dark pl-3">
              The Living Money Model
            </span>
          </div>

          {/* Quick Anchor Links */}
          <div className="flex flex-wrap items-center gap-6 font-mono text-xs tracking-wider uppercase text-ink-mutedLight">
            <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
            <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#worlds" className="hover:text-white transition-colors">Worlds</a>
            <a href="#preview" className="hover:text-white transition-colors">Console</a>
            <a href="#ethics" className="hover:text-white transition-colors">Ethics</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
        </div>

        {/* Compliance Guardrail Disclaimer */}
        <div className="p-6 bg-canvas-card border border-border-dark font-mono text-[11px] leading-relaxed text-ink-mutedLight">
          <span className="text-thread font-bold uppercase tracking-wider block mb-1">
            STATUTORY EDUCATIONAL & NON-ADVISORY COMPLIANCE NOTICE
          </span>
          <p>
            INARI is designed strictly as an educational financial modeling and simulation interface. It executes deterministic mathematical calculations based on user-provided transaction data. INARI does not offer registered investment advice, solicit securities, broker investment products, or endorse specific stocks, mutual funds, exchange-traded funds, or cryptocurrency assets. Past financial trajectories do not guarantee future cash flow performance.
          </p>
        </div>

        {/* Bottom Copyright Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-[11px] text-ink-mutedLight uppercase tracking-wider">
          <div>
            © {new Date().getFullYear()} INARI FINANCIAL SYSTEMS. ALL RIGHTS RESERVED.
          </div>
          <div className="flex items-center gap-4">
            <span>DETERMINISTIC ENGINE V2.4.1</span>
            <span>•</span>
            <span>ZERO AFFILIATE BROKERS</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

