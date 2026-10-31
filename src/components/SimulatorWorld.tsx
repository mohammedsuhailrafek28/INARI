import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, Check, FileText, User } from 'lucide-react';

export const SimulatorWorld: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(900);
  const [secTop, setSecTop] = useState(0);
  const [secHeight, setSecHeight] = useState(1200);

  useEffect(() => {
    const updateMetrics = () => {
      setScrollY(window.scrollY);
      setViewportH(window.innerHeight || 900);
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        setSecTop(rect.top + window.scrollY);
        setSecHeight(rect.height);
      }
    };

    updateMetrics();
    window.addEventListener('scroll', updateMetrics, { passive: true });
    window.addEventListener('resize', updateMetrics, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateMetrics);
      window.removeEventListener('resize', updateMetrics);
    };
  }, []);

  // Relative scroll progression through SimulatorWorld [0, 1]
  const scrollCursor = scrollY + viewportH * 0.5;
  const progress = Math.min(
    1,
    Math.max(0, (scrollCursor - secTop) / Math.max(1, secHeight))
  );

  // Parallax calculations exactly matching Reference Images 1 & 2:
  // Image 1 (top of section): modal sits lower down (showing the giant word above)
  // Image 2 (scrolled down): modal glides smoothly upwards over the mammoth letters
  const modalY = (1 - progress) * 200 - 60;
  const titleDrift = (progress - 0.5) * -70;

  // Floating surrounding cards parallax
  const card1Y = (1 - progress) * 120 - 20;
  const card2Y = (1 - progress) * 180 - 40;
  const card3Y = (1 - progress) * 100 - 15;
  const card4Y = (1 - progress) * 160 - 30;

  // Thread animation length ~ 3600
  const THREAD_LEN = 3600;
  const threadDashoffset = THREAD_LEN * Math.max(0, 1 - progress * 1.25);

  return (
    <article
      ref={sectionRef}
      id="simulation"
      className="project-world world-dark relative w-full bg-[#050505] text-[#f1eee6] min-h-[1050px] lg:min-h-[1250px] overflow-hidden select-none transition-colors duration-500 pt-20 sm:pt-24"
      aria-labelledby="simulation-title"
    >
      {/* ======================================================== */}
      {/* 1. TOP HEADER / KICKER & DESCRIPTIVE STATEMENT           */}
      {/* ======================================================== */}
      <div className="absolute top-20 sm:top-24 left-6 sm:left-10 lg:left-14 z-30">
        <span className="font-archivo font-extrabold text-xl sm:text-2xl text-white tracking-tight block">
          INARI
        </span>
        <span className="font-mono text-xs sm:text-sm tracking-[0.08em] uppercase text-[#888888] font-bold block mt-1">
          02 / SCENARIO SIMULATION
        </span>
      </div>

      <p className="world-description absolute top-20 sm:top-24 right-6 sm:right-10 lg:right-14 max-w-[85%] sm:max-w-[420px] md:max-w-[460px] text-right font-mono text-xs sm:text-sm text-[#cccccc] leading-relaxed z-30">
        Ask what-if scenarios and INARI dynamically simulates cash flow impacts across all your goals.
      </p>

      {/* ======================================================== */}
      {/* 2. DYNAMIC VERMILION THREAD LAYER (SVG)                  */}
      {/* ======================================================== */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[12]"
        viewBox="0 0 1440 1100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Continuous thread entering from Section 01's exit at (1320, 0) */}
        {/* Subtle guide track */}
        <path
          d="M 1320 0 C 1320 60, 1260 90, 1100 110 C 920 130, 680 90, 520 140 C 340 200, 180 290, 120 400 C 60 520, 90 620, 220 660 C 380 710, 560 670, 720 730 C 750 740, 760 760, 760 790"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="1"
          strokeOpacity="0.15"
          vectorEffect="non-scaling-stroke"
        />

        {/* Animated active thread */}
        <path
          d="M 1320 0 C 1320 60, 1260 90, 1100 110 C 920 130, 680 90, 520 140 C 340 200, 180 290, 120 400 C 60 520, 90 620, 220 660 C 380 710, 560 670, 720 730 C 750 740, 760 760, 760 790"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={THREAD_LEN}
          strokeDashoffset={threadDashoffset}
          vectorEffect="non-scaling-stroke"
          className="transition-[stroke-dashoffset] duration-75 ease-out"
        />

        {/* Target Bullseye Node at bottom center (Image 1 & 2) */}
        <g transform="translate(760, 790)">
          <circle cx="0" cy="0" r="16" fill="none" stroke="#ff3b12" strokeWidth="1.2" opacity="0.4" className="animate-ping" />
          <circle cx="0" cy="0" r="13" fill="none" stroke="#ff3b12" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="4.5" fill="#ff3b12" />
        </g>
      </svg>

      {/* ======================================================== */}
      {/* 3. MAMMOTH BACKGROUND TYPOGRAPHY (SIMULATE)              */}
      {/* ======================================================== */}
      <div
        className="absolute top-[21%] sm:top-[23%] left-0 right-0 w-full text-center z-[10] pointer-events-none select-none overflow-hidden"
        style={{
          transform: `translate3d(${titleDrift}px, 0, 0)`,
        }}
      >
        <h3
          id="simulation-title"
          className="font-archivo font-[900] text-[15.5vw] md:text-[14.5vw] leading-[0.78] tracking-[-0.04em] text-[#e8e4dc] uppercase opacity-95 inline-block whitespace-nowrap"
        >
          SIMULATE
        </h3>
      </div>

      {/* ======================================================== */}
      {/* 4. SURROUNDING FLOATING CONTEXTUAL CARDS (PARALLAX)      */}
      {/* ======================================================== */}

      {/* Card 1: Top-Left (Dining Out / Discretionary Cut) */}
      <div
        className="absolute left-[3%] sm:left-[6%] lg:left-[8%] top-[50%] sm:top-[52%] w-[190px] sm:w-[230px] p-3.5 rounded-lg bg-[#0c0c0c]/85 border border-white/15 text-white shadow-2xl backdrop-blur-md z-[15] font-mono text-[11px] leading-tight transition-transform duration-300"
        style={{ transform: `translate3d(0, ${card1Y}px, 0) rotate(-2deg)` }}
      >
        <div className="flex items-center gap-1.5 text-[#ff3b12] text-[9px] uppercase tracking-wider font-bold mb-1">
          <span>DINING OUT</span>
        </div>
        <div className="font-bold text-white text-xs mb-1">Re: Restaurant spend</div>
        <div className="text-[9px] text-[#888888] mb-1.5">FROM transactions.csv</div>
        <div className="text-[#cccccc] text-[10px] leading-relaxed mb-2">
          Swiggy & dining cut by 30%: reclaims ₹4,200/mo surplus.
        </div>
        <div className="text-[9px] uppercase tracking-wider text-[#10b981] font-bold">
          ACTION APPLIED
        </div>
      </div>

      {/* Card 2: Bottom-Left (Rent Escalation Shock) */}
      <div
        className="absolute left-[5%] sm:left-[9%] lg:left-[11%] top-[72%] sm:top-[74%] w-[205px] sm:w-[245px] p-3.5 rounded-lg bg-[#0c0c0c]/85 border border-white/15 text-white shadow-2xl backdrop-blur-md z-[15] font-mono text-[11px] leading-tight transition-transform duration-300"
        style={{ transform: `translate3d(0, ${card2Y}px, 0) rotate(1.5deg)` }}
      >
        <div className="flex items-center gap-1.5 text-[#ff3b12] text-[9px] uppercase tracking-wider font-bold mb-1">
          <span>RENT LEASE</span>
        </div>
        <div className="font-bold text-white text-xs mb-1">Indiranagar 2BHK Contract</div>
        <div className="text-[#888888] text-[10px] mb-1">Lease escalation: +10%</div>
        <div className="text-white font-bold text-sm mb-1.5">₹22,000 → ₹24,200</div>
        <div className="text-[9px] uppercase tracking-wider text-[#10b981] font-bold">
          SHOCK ABSORBED BY SURPLUS
        </div>
      </div>

      {/* Card 3: Top-Right (MacBook Goal Milestone) */}
      <div
        className="absolute right-[3%] sm:right-[6%] lg:right-[8%] top-[52%] sm:top-[54%] w-[190px] sm:w-[230px] p-3.5 rounded-lg bg-[#0c0c0c]/85 border border-white/15 text-white shadow-2xl backdrop-blur-md z-[15] font-mono text-[11px] leading-tight transition-transform duration-300"
        style={{ transform: `translate3d(0, ${card3Y}px, 0) rotate(2deg)` }}
      >
        <div className="flex items-center gap-1.5 text-[#ff3b12] text-[9px] uppercase tracking-wider font-bold mb-1">
          <span>GOAL WATERFALL</span>
        </div>
        <div className="font-bold text-white text-xs mb-1">MacBook Studio Rig</div>
        <div className="text-[9px] text-[#888888] mb-1.5">TARGET / ₹1,50,000</div>
        <div className="text-[#cccccc] text-[10px] leading-relaxed mb-2">
          Waterfall allocates positive surplus sequentially.
        </div>
        <div className="text-[9px] uppercase tracking-wider text-[#10b981] font-bold">
          ADVANCES BY 3.5 MONTHS
        </div>
      </div>

      {/* Card 4: Bottom-Right (Emergency Runway within plan) */}
      <div
        className="absolute right-[5%] sm:right-[9%] lg:right-[11%] top-[74%] sm:top-[76%] w-[200px] sm:w-[230px] p-3.5 rounded-lg bg-[#0c0c0c]/85 border border-white/15 text-white shadow-2xl backdrop-blur-md z-[15] font-mono text-[11px] leading-tight transition-transform duration-300"
        style={{ transform: `translate3d(0, ${card4Y}px, 0) rotate(-1.5deg)` }}
      >
        <div className="flex items-center gap-1.5 text-[#ff3b12] text-[9px] uppercase tracking-wider font-bold mb-1">
          <span>LIQUID BUFFER</span>
        </div>
        <div className="font-bold text-white text-xs mb-1">Emergency Runway</div>
        <div className="text-[9px] text-[#888888] mb-1">TARGET 6.0 MO</div>
        <div className="text-2xl font-archivo font-extrabold text-white mb-1.5">
          6.2 <span className="text-xs font-mono font-normal text-[#888888]">mo</span>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-[#10b981] font-bold">
          WITHIN PLAN
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. THE CENTRAL "AGENTIC SIMULATOR" CARD (HERO MODAL)     */}
      {/* ======================================================== */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[46%] sm:top-[44%] lg:top-[40%] w-[92%] sm:w-[82%] max-w-[670px] z-[25] transition-transform duration-200 ease-out"
        style={{
          transform: `translate3d(-50%, ${modalY}px, 0)`,
        }}
      >
        <div className="bg-[#f7f5ef] text-[#0a0a0a] rounded-xl shadow-[0_35px_100px_rgba(0,0,0,0.85)] border border-white/30 overflow-hidden select-text">
          {/* Card Top Title Bar */}
          <div className="px-5 py-3.5 sm:px-6 border-b border-black/10 flex items-center justify-between">
            <span className="font-archivo font-extrabold text-sm sm:text-base tracking-tight text-[#0a0a0a]">
              INARI
            </span>
            <span className="font-mono text-[10px] sm:text-xs text-[#666666] tracking-wide">
              One living model. Every scenario within reach.
            </span>
          </div>

          <div className="p-5 sm:p-6 sm:py-7 space-y-6">
            {/* Step 1: User What-If Input */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 font-mono text-xs sm:text-sm text-[#0a0a0a] leading-relaxed pt-1">
                Find the impact of cutting dining out by 30%, absorb a 10% rent increase, and project my MacBook goal.
              </div>
            </div>

            {/* Step 2: Agent Tools in Progress */}
            <div className="flex items-start gap-3 sm:gap-4 pt-3 border-t border-black/10">
              <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Search className="w-4 h-4" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="font-mono text-xs text-[#0a0a0a]">
                  Working across connected living models...
                </div>
                <div className="font-mono text-[10px] sm:text-[11px] text-[#666666] tracking-wider uppercase font-semibold">
                  LEDGER · FIXED COSTS · WATERFALL · RUNWAY
                </div>
              </div>
            </div>

            {/* Step 3: Response Drafted & Direct Action CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-black/10">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-archivo font-bold text-sm sm:text-base text-[#0a0a0a]">
                    Scenario Projected
                  </div>
                  <div className="font-mono text-[10px] sm:text-xs text-[#555555] tracking-wide uppercase mt-0.5">
                    SURPLUS +₹3,400/MO · MACBOOK ACCELERATED +3.5 MO
                  </div>
                </div>
              </div>

              <a
                href="/dashboard/planner"
                className="self-end sm:self-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#ff3b12] text-white font-mono text-xs font-bold transition-colors group shadow-sm"
              >
                <Check className="w-3.5 h-3.5 text-[#ff3b12] group-hover:text-white transition-colors" />
                <span>Review & Simulate →</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. BOTTOM PROJECT LINK (EXPLORE SIMULATION)              */}
      {/* ======================================================== */}
      <a
        href="/dashboard/planner"
        className="world-link absolute bottom-8 sm:bottom-10 right-6 sm:right-10 lg:right-14 font-mono text-xs sm:text-sm tracking-[0.07em] uppercase text-white pb-1.5 border-b border-white inline-flex items-center gap-4 hover:text-[#ff3b12] hover:border-[#ff3b12] transition-colors z-30"
      >
        EXPLORE PROJECT
        <span className="interaction-arrow">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </a>
    </article>
  );
};
