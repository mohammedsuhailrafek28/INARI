import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Wallet, Check, ShieldCheck, Activity } from 'lucide-react';

export const BufferWorld: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(900);
  const [secTop, setSecTop] = useState(0);
  const [secHeight, setSecHeight] = useState(1450);

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

  // Relative scroll progression through BufferWorld [0, 1]
  const scrollCursor = scrollY + viewportH * 0.45;
  const progress = Math.min(
    1,
    Math.max(0, (scrollCursor - secTop) / Math.max(1, secHeight - viewportH * 0.3))
  );

  // Kinetic Parallax matching Reference Images 1 & 2:
  // Image 1: Top of section (word is in mid-lower half, bubbles & wallet card on top)
  // Image 2: Scrolled down (word glides up, paper receipt and bag glide into view)
  const titleY = (progress - 0.5) * -120;
  const titleDrift = (progress - 0.5) * -50;

  // Parallax offsets for floating items
  const bubble1Y = (1 - progress) * 60 - 20;
  const bubble2Y = (1 - progress) * 90 - 30;
  const walletCardY = (1 - progress) * 120 - 40;
  const receiptY = (1 - progress) * 200 - 120;
  const bagY = (1 - progress) * 160 - 90;

  // Thread animation length ~ 3800
  const THREAD_LEN = 3800;
  const threadDashoffset = THREAD_LEN * Math.max(0, 1 - progress * 1.35);

  return (
    <article
      ref={sectionRef}
      id="buffer"
      className="project-world world-light relative w-full bg-[#f1eee6] text-[#050505] min-h-[1350px] lg:min-h-[1550px] overflow-hidden select-none transition-colors duration-500 pt-20 sm:pt-24"
      aria-labelledby="buffer-title"
    >
      {/* ======================================================== */}
      {/* 1. TOP HEADER / KICKER & DESCRIPTIVE STATEMENT           */}
      {/* ======================================================== */}
      <div className="absolute top-20 sm:top-24 left-6 sm:left-10 lg:left-14 z-30">
        <span className="font-archivo font-extrabold text-xl sm:text-2xl text-[#050505] tracking-tight block">
          INARI
        </span>
        <span className="font-mono text-xs sm:text-sm tracking-[0.08em] uppercase text-[#66625b] font-bold block mt-1">
          03 / LIQUID RUNWAY & BUFFER
        </span>
      </div>

      <p className="world-description absolute top-20 sm:top-24 right-6 sm:right-10 lg:right-14 max-w-[85%] sm:max-w-[420px] md:max-w-[480px] text-right font-mono text-xs sm:text-sm text-[#44403c] leading-relaxed z-30">
        Translates liquid reserves into mathematical survival time. 6.2 Months of non-discretionary expenses securely banked against life shocks.
      </p>

      {/* ======================================================== */}
      {/* 2. BACKGROUND ARCHITECTURAL GAUGES (FINE LINE ART)       */}
      {/* ======================================================== */}
      {/* Precision Caliper / Ruler on far left (matching the fork line art) */}
      <div className="absolute left-6 sm:left-10 lg:left-14 top-[24%] bottom-[16%] w-12 pointer-events-none opacity-40 z-[8]">
        <svg viewBox="0 0 48 600" className="w-full h-full stroke-current" fill="none" strokeWidth="1.2">
          {/* Caliper Prongs */}
          <path d="M 12 10 L 12 80 C 12 95, 24 105, 24 120 L 24 580 C 24 590, 18 595, 12 595" />
          <path d="M 24 10 L 24 80" />
          <path d="M 36 10 L 36 80 C 36 95, 24 105, 24 120" />
          {/* Graduation Ticks */}
          <line x1="24" y1="160" x2="36" y2="160" />
          <line x1="24" y1="200" x2="32" y2="200" />
          <line x1="24" y1="240" x2="38" y2="240" />
          <line x1="24" y1="280" x2="32" y2="280" />
          <line x1="24" y1="320" x2="40" y2="320" />
          <line x1="24" y1="360" x2="32" y2="360" />
          <line x1="24" y1="400" x2="38" y2="400" />
        </svg>
      </div>

      {/* Concentric Dial / Compass Gauge (matching the plate line art) */}
      <div className="absolute left-[4%] sm:left-[8%] lg:left-[12%] top-[18%] sm:top-[20%] w-[380px] sm:w-[480px] lg:w-[560px] aspect-square rounded-full pointer-events-none opacity-30 z-[7]">
        <svg viewBox="0 0 500 500" className="w-full h-full stroke-current" fill="none" strokeWidth="1">
          <circle cx="250" cy="250" r="230" strokeDasharray="3 3" />
          <circle cx="250" cy="250" r="200" />
          <circle cx="250" cy="250" r="160" strokeDasharray="1 4" strokeWidth="1.5" />
          <circle cx="250" cy="250" r="130" />
          <circle cx="250" cy="250" r="80" strokeDasharray="2 6" />
        </svg>
      </div>

      {/* ======================================================== */}
      {/* 3. DYNAMIC VERMILION THREAD LAYER (SVG)                  */}
      {/* ======================================================== */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[12]"
        viewBox="0 0 1440 1450"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Continuous thread entering from Section 02's target at (750, 0) */}
        {/* Subtle guide track */}
        <path
          d="M 750 0 C 750 60, 770 120, 790 190 C 820 280, 720 260, 560 270 C 420 280, 480 340, 540 370 C 660 410, 840 370, 960 420 C 1080 470, 1150 560, 1080 680 C 1000 800, 780 740, 600 790 C 440 840, 360 920, 420 1020 C 480 1110, 680 1080, 880 1140 C 980 1170, 1020 1250, 960 1310 C 880 1380, 700 1320, 640 1240 C 620 1210, 630 1180, 660 1170 C 690 1160, 720 1190, 710 1230"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="1"
          strokeOpacity="0.18"
          vectorEffect="non-scaling-stroke"
        />

        {/* Animated active thread */}
        <path
          d="M 750 0 C 750 60, 770 120, 790 190 C 820 280, 720 260, 560 270 C 420 280, 480 340, 540 370 C 660 410, 840 370, 960 420 C 1080 470, 1150 560, 1080 680 C 1000 800, 780 740, 600 790 C 440 840, 360 920, 420 1020 C 480 1110, 680 1080, 880 1140 C 980 1170, 1020 1250, 960 1310 C 880 1380, 700 1320, 640 1240 C 620 1210, 630 1180, 660 1170 C 690 1160, 720 1190, 710 1230"
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

        {/* Target Bullseye Node at bottom loop (Image 1 & 2) */}
        <g transform="translate(710, 1230)">
          <circle cx="0" cy="0" r="16" fill="none" stroke="#ff3b12" strokeWidth="1.2" opacity="0.4" className="animate-ping" />
          <circle cx="0" cy="0" r="13" fill="none" stroke="#ff3b12" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="4.5" fill="#ff3b12" />
        </g>
      </svg>

      {/* ======================================================== */}
      {/* 4. MAMMOTH BACKGROUND TYPOGRAPHY (BUFFER)                */}
      {/* ======================================================== */}
      <div
        className="absolute top-[40%] sm:top-[38%] left-0 right-0 w-full text-center z-[10] pointer-events-none select-none overflow-hidden"
        style={{
          transform: `translate3d(${titleDrift}px, ${titleY}px, 0)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <h3
          id="buffer-title"
          className="font-archivo font-[900] text-[18vw] sm:text-[17vw] lg:text-[16vw] leading-[0.76] tracking-[-0.05em] text-[#050505] uppercase inline-block whitespace-nowrap"
        >
          BUFFER
        </h3>
      </div>

      {/* ======================================================== */}
      {/* 5. FLOATING INTERACTION ELEMENTS (MATCHING IMAGE 1)      */}
      {/* ======================================================== */}

      {/* Element 1: Dark User Request / Alert Bubble */}
      <div
        className="absolute left-[48%] sm:left-[52%] top-[19%] sm:top-[21%] z-[20] transition-transform duration-200"
        style={{ transform: `translate3d(0, ${bubble1Y}px, 0)` }}
      >
        <div className="font-mono text-[9px] uppercase tracking-wider text-[#66625b] mb-1.5 font-bold">
          UPI / SMS SENTINEL
        </div>
        <div className="bg-[#0c0c0c] text-white rounded-2xl px-5 py-3.5 shadow-2xl font-mono text-xs sm:text-sm max-w-[280px] sm:max-w-[320px] relative">
          <span>HDFC Alert: ₹850 debited at Swiggy Indiranagar.</span>
          {/* Speech tail */}
          <div className="absolute -bottom-2 left-6 w-3 h-3 bg-[#0c0c0c] rotate-45" />
        </div>
      </div>

      {/* Element 2: Light System Response Bubble */}
      <div
        className="absolute left-[26%] sm:left-[32%] top-[29%] sm:top-[31%] z-[18] transition-transform duration-200"
        style={{ transform: `translate3d(0, ${bubble2Y}px, 0)` }}
      >
        <div className="bg-white/95 border border-black/15 text-[#11100f] rounded-2xl px-5 py-3 shadow-md font-mono text-xs sm:text-sm max-w-[280px] sm:max-w-[320px] relative">
          <div className="font-bold text-black mb-0.5">Transaction verified.</div>
          <div className="text-[#55524c]">Discretionary buffer impact: within monthly burn.</div>
          {/* Speech tail */}
          <div className="absolute -bottom-2 right-8 w-3 h-3 bg-white border-b border-r border-black/15 rotate-45" />
        </div>
      </div>

      {/* Element 3: Dark Horizontal Liquid Reserve Card (matching Company Wallet) */}
      <div
        className="absolute right-[4%] sm:right-[8%] lg:right-[10%] top-[34%] sm:top-[36%] z-[22] transition-transform duration-200"
        style={{ transform: `translate3d(0, ${walletCardY}px, 0)` }}
      >
        <div className="bg-[#0c0c0c] text-white rounded-xl px-5 py-3 sm:px-6 sm:py-3.5 shadow-2xl flex items-center gap-6 sm:gap-8 border border-white/10 font-mono">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-white/10 text-white">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </span>
            <div>
              <div className="text-[10px] sm:text-xs text-[#888888] uppercase tracking-wider">
                LIQUID RESERVE
              </div>
              <div className="text-[9px] text-[#10b981] font-bold">
                SAFE HARBOR
              </div>
            </div>
          </div>

          <div className="border-l border-white/15 pl-5 sm:pl-6">
            <div className="text-sm sm:text-base font-bold text-white tracking-tight">
              ₹1,35,000
            </div>
            <div className="text-[10px] text-[#888888]">
              -₹850
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            <Check className="w-3.5 h-3.5 text-black" />
            <span>6.2 MO BUFFERED</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. SCROLLED PHYSICAL ARTIFACTS (MATCHING IMAGE 2)        */}
      {/* ======================================================== */}

      {/* Artifact A: Jagged-Edge Paper Receipt Slip (Center-Left) */}
      <div
        className="absolute left-[18%] sm:left-[24%] lg:left-[28%] top-[56%] sm:top-[58%] w-[230px] sm:w-[260px] z-[22] transition-transform duration-200"
        style={{ transform: `translate3d(0, ${receiptY}px, 0) rotate(-4deg)` }}
      >
        <div className="bg-[#ffffff] text-[#11100f] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-black/10 font-mono text-xs relative select-text">
          {/* Top serrated paper edge simulation */}
          <div className="text-[9px] uppercase tracking-widest text-[#77736b] font-bold mb-3 pb-2 border-b border-dashed border-black/20 flex items-center justify-between">
            <span>TRANSACTION CONFIRMED</span>
            <Activity className="w-3 h-3 text-[#ff3b12]" />
          </div>

          <div className="font-bold text-sm mb-1 text-black">Swiggy Indiranagar</div>
          <div className="flex items-center justify-between text-[11px] text-[#55524c] mb-1">
            <span>Dining Out</span>
            <span className="font-bold">1 order</span>
          </div>
          <div className="flex items-center justify-between font-bold text-sm text-black pt-2 border-t border-black/10 mb-4">
            <span>Total Debited</span>
            <span>₹850</span>
          </div>

          <div className="pt-2 border-t border-dashed border-black/20 text-[10px] text-[#55524c] leading-relaxed">
            <div className="font-bold text-[#10b981] mb-1">✓ WITHIN LIQUID RUNWAY</div>
            <div>Safe to spend. Primary MacBook & emergency targets preserved.</div>
          </div>
        </div>
      </div>

      {/* Artifact B: The Tactile Reserve Vault Bag (Bottom-Right) */}
      <div
        className="absolute right-[8%] sm:right-[14%] lg:right-[18%] top-[64%] sm:top-[66%] w-[200px] sm:w-[230px] z-[22] transition-transform duration-200"
        style={{ transform: `translate3d(0, ${bagY}px, 0) rotate(3deg)` }}
      >
        <div className="bg-[#faf8f5] text-[#11100f] p-5 rounded-lg shadow-[0_25px_60px_rgba(0,0,0,0.12)] border border-black/15 font-mono text-center relative">
          {/* Bag Handles */}
          <div className="w-16 h-8 rounded-t-full border-2 border-black/30 mx-auto -mt-9 mb-2" />
          
          <div className="w-10 h-10 rounded-full bg-black/5 mx-auto flex items-center justify-center mb-2.5">
            <ShieldCheck className="w-5 h-5 text-[#ff3b12]" />
          </div>

          <div className="font-bold text-xs sm:text-sm tracking-wider uppercase text-black mb-1">
            RUNWAY INTACT
          </div>
          <div className="text-[10px] text-[#77736b] uppercase tracking-wider mb-2">
            Target 6.0 mo · Current 6.2 mo
          </div>
          <div className="px-2.5 py-1 rounded bg-[#10b981]/15 text-[#10b981] font-bold text-[9px] uppercase tracking-wider inline-block">
            SAFE ZONE SECURED
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 7. BOTTOM PROJECT LINK (EXPLORE RUNWAY & PROFILE)        */}
      {/* ======================================================== */}
      <a
        href="/dashboard/profile"
        className="world-link absolute bottom-12 right-6 sm:right-10 lg:right-14 font-mono text-xs sm:text-sm tracking-[0.07em] uppercase text-[#050505] pb-1.5 border-b border-[#050505] inline-flex items-center gap-4 hover:text-[#ff3b12] hover:border-[#ff3b12] transition-colors z-30"
      >
        EXPLORE PROJECT
        <span className="interaction-arrow">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </a>
    </article>
  );
};

