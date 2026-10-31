import React from 'react';
import { ArrowUpRight, Code2 } from 'lucide-react';
import { LIVING_WORLDS_DATA } from '../data/mock';
import { IngestionWorld } from './IngestionWorld';
import { SimulatorWorld } from './SimulatorWorld';
import { BufferWorld } from './BufferWorld';

export const LivingWorlds: React.FC = () => {
  // World 01 is Ingestion (Property Management / Eigna architecture)
  // World 02 is Simulation (Agentic AI / Orbit architecture)
  // World 03 is Buffer & Runway (Workplace Meals / Mealops architecture)
  const remainingWorlds = LIVING_WORLDS_DATA.slice(3);

  return (
    <div id="worlds" className="relative w-full overflow-hidden">
      {/* Section 01: Ingestion (Interactive Blueprint, Lease, Window, Wrench & Ledger Stage) */}
      <IngestionWorld />

      {/* Section 02: Simulator & Agentic What-If (Interactive Mammoth Display, Floating Tools & Parallax Modal) */}
      <SimulatorWorld />

      {/* Section 03: Buffer & Liquid Runway (Interactive Precision Gauges, Alert Bubbles & Paper Artifacts) */}
      <BufferWorld />

      {/* Remaining Worlds: What-If, Nudges, Review */}
      {remainingWorlds.map((world) => {
        const isDark = world.theme === 'dark';
        return (
          <section
            key={world.id}
            id={world.id}
            className={`relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 border-t transition-colors duration-500 ${
              isDark
                ? 'bg-canvas-dark text-ink-light border-border-dark'
                : 'bg-canvas-light text-ink-dark border-border-light'
            }`}
          >
            {/* Top Index & Header */}
            <div className="w-full max-w-[1360px] mx-auto flex items-center justify-between font-mono text-xs md:text-sm tracking-wideMono uppercase pb-6 border-b border-current/10">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 ${isDark ? 'bg-thread' : 'bg-ink-dark'}`} />
                <span>WORLD {world.index} // {world.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>STAGE: ACTIVE MODEL</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
              {/* Left Column: Mammoth Wordmark & Headline */}
              <div className="lg:col-span-7 flex flex-col">
                <h3 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[8rem] xl:text-[9.5rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                  {world.title}
                </h3>

                <div className="mt-8">
                  <h4 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                    {world.headline}
                  </h4>
                  <p className={`font-sans text-lg sm:text-xl max-w-xl leading-relaxed ${isDark ? 'text-ink-mutedLight' : 'text-ink-mutedDark'}`}>
                    {world.subtext}
                  </p>
                </div>

                {/* Key Statistics Pill Grid */}
                <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-current/10 max-w-lg">
                  {world.stats.map((s, idx) => (
                    <div key={idx} className="flex flex-col">
                      <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                        {s.label}
                      </span>
                      <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Code & Telemetry Terminal */}
              <div className="lg:col-span-5 w-full">
                <div className={`p-6 md:p-8 font-mono border rounded-none shadow-2xl ${
                  isDark
                    ? 'bg-canvas-card border-border-dark text-ink-light'
                    : 'bg-white/90 border-black/10 text-ink-dark shadow-[0_20px_50px_rgba(0,0,0,0.06)]'
                }`}>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-current/10 text-xs">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-thread" />
                      <span className="font-bold tracking-wider uppercase">INARI ENGINE REPL</span>
                    </div>
                    <span className="text-[10px] opacity-60">PYTHON 3.12 DETERMINISTIC</span>
                  </div>

                  <pre className="text-xs sm:text-sm leading-relaxed overflow-x-auto whitespace-pre font-mono opacity-90 p-2">
                    <code>{world.codeSnippet}</code>
                  </pre>

                  <div className="mt-6 pt-4 border-t border-current/10 flex items-center justify-between text-[11px] opacity-75">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
                      SYSTEM STATUS: DETERMINISTIC
                    </span>
                    <span>SEED: 42</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};
