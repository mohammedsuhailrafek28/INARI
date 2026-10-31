import React, { useEffect, useState, useRef } from 'react';
import { FileSpreadsheet, GitBranch, Sliders } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../data/mock';

export const HowItWorks: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionTop, setSectionTop] = useState(900);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          if (sectionRef.current) {
            setSectionTop(sectionRef.current.offsetTop);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Compute relative scroll inside this section
  const relScroll = Math.max(0, scrollY - (sectionTop - 300));

  // Kinetic alternating horizontal velocity during scroll
  const velocityRate = 0.088;
  const line1X = -relScroll * velocityRate;
  const line2X = relScroll * velocityRate; // REVERSE
  const line3X = -relScroll * velocityRate;
  const line4X = relScroll * velocityRate; // REVERSE

  // Thread draw progress through this section (from 0 to 1)
  const threadProgress = Math.min(Math.max((scrollY - (sectionTop - 200)) / 750, 0), 1);
  const totalPathLength = 2600; // approximate length of the bulb spline
  const dashOffset = totalPathLength * (1 - threadProgress);

  const icons = [
    <FileSpreadsheet className="w-5 h-5 text-[#ff3b12]" key="1" />,
    <GitBranch className="w-5 h-5 text-[#ff3b12]" key="2" />,
    <Sliders className="w-5 h-5 text-[#ff3b12]" key="3" />,
  ];

  return (
    <section
      ref={sectionRef}
      id="architecture"
      className="selected-work relative w-full bg-[#f1eee6] text-[#11100f] overflow-hidden select-none"
    >
      {/* ======================================================== */}
      {/* 1. PRACTICE INTRO (Top 100vh Hero-matching Stage)        */}
      {/* ======================================================== */}
      <div className="practice-intro relative min-h-[100svh] w-full flex flex-col justify-between px-6 sm:px-10 lg:px-14 pt-20 sm:pt-28 pb-12">
        <div className="w-full max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto">
          
          {/* Left Column: 4-Line Mammoth Headline with Kinetic Drift */}
          <div className="lg:col-span-7 flex flex-col z-10">
            <h2
              id="work-title"
              className="font-archivo font-[800] text-[clamp(3.5rem,8.4vw,7.4rem)] leading-[0.82] tracking-[-0.075em] uppercase text-[#11100f] my-auto"
            >
              {/* Line 1: Shifts LEFT */}
              <span className="block overflow-visible">
                <span
                  className="block whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translate3d(${line1X}px, 0, 0)`,
                    transition: 'transform 0.04s linear',
                  }}
                >
                  FROM WHAT
                </span>
              </span>

              {/* Line 2: Shifts RIGHT (REVERSE) */}
              <span className="block overflow-visible">
                <span
                  className="block whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translate3d(${line2X}px, 0, 0)`,
                    transition: 'transform 0.04s linear',
                  }}
                >
                  PEOPLE NEED
                </span>
              </span>

              {/* Line 3: Shifts LEFT */}
              <span className="block overflow-visible">
                <span
                  className="block whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translate3d(${line3X}px, 0, 0)`,
                    transition: 'transform 0.04s linear',
                  }}
                >
                  TO WHAT
                </span>
              </span>

              {/* Line 4: Shifts RIGHT (REVERSE) */}
              <span className="block overflow-visible">
                <span
                  className="block whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translate3d(${line4X}px, 0, 0)`,
                    transition: 'transform 0.04s linear',
                  }}
                >
                  FEELS RIGHT.
                </span>
              </span>
            </h2>

            {/* Subtext description below headline */}
            <p className="practice-description font-mono text-xs sm:text-sm md:text-base text-[#66625b] mt-8 sm:mt-12 max-w-lg leading-relaxed">
              I connect human intent, living money models and the financial systems underneath.
            </p>
          </div>

          {/* Right Column: The Vermilion Lightbulb Thread Drawing */}
          <div className="lg:col-span-5 relative w-full h-[520px] sm:h-[620px] lg:h-[720px] flex items-center justify-center">
            {/* SVG Canvas for the Lightbulb Spline */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
              viewBox="800 870 500 950"
              preserveAspectRatio="xMidYMid meet"
              aria-label="One continuous thread forms a bulb for intent, then descends connecting interaction and system."
            >
              <defs>
                <filter id="bulbGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Faint Guide Track */}
              <path
                d="M 1046.52 879.92 C 1046.52 925, 1046.52 925, 1046.52 1019.76 C 1046.52 1144.94 1059.00 1244.78 1059.00 1344.62 C 1059.00 1384.56 1096.44 1384.56 1096.44 1344.62 C 1096.44 1284.72 1215.00 1264.75 1215.00 1174.90 C 1215.00 1090.03 1140.12 1035.12 1046.52 1035.12 C 952.92 1035.12 878.04 1090.03 878.04 1174.90 C 878.04 1264.75 996.60 1284.72 996.60 1344.62 L 996.60 1436.78 C 996.60 1452.14 1015.80 1459.82 1035.00 1459.82 L 1132.92 1459.82 C 1171.32 1459.82 1171.32 1513.58 1132.92 1513.58 L 993.72 1513.58 C 955.32 1513.58 955.32 1567.34 993.72 1567.34 L 1132.92 1567.34 C 1171.32 1567.34 1171.32 1621.10 1132.92 1621.10 L 1051.32 1621.10 C 1003.32 1621.10 1003.32 1676.40 1003.32 1734 L 1003.32 1800 L 1180 1800"
                fill="none"
                stroke="rgba(255, 59, 18, 0.15)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dynamic Animated Vermilion Spline */}
              <path
                d="M 1046.52 879.92 C 1046.52 925, 1046.52 925, 1046.52 1019.76 C 1046.52 1144.94 1059.00 1244.78 1059.00 1344.62 C 1059.00 1384.56 1096.44 1384.56 1096.44 1344.62 C 1096.44 1284.72 1215.00 1264.75 1215.00 1174.90 C 1215.00 1090.03 1140.12 1035.12 1046.52 1035.12 C 952.92 1035.12 878.04 1090.03 878.04 1174.90 C 878.04 1264.75 996.60 1284.72 996.60 1344.62 L 996.60 1436.78 C 996.60 1452.14 1015.80 1459.82 1035.00 1459.82 L 1132.92 1459.82 C 1171.32 1459.82 1171.32 1513.58 1132.92 1513.58 L 993.72 1513.58 C 955.32 1513.58 955.32 1567.34 993.72 1567.34 L 1132.92 1567.34 C 1171.32 1567.34 1171.32 1621.10 1132.92 1621.10 L 1051.32 1621.10 C 1003.32 1621.10 1003.32 1676.40 1003.32 1734 L 1003.32 1800 L 1180 1800"
                fill="none"
                stroke="#ff3b12"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={totalPathLength}
                strokeDashoffset={dashOffset}
                filter="url(#bulbGlow)"
              />

              {/* End Concentric Halo & Dot at bottom right */}
              <circle cx="1180" cy="1800" r="12" fill="none" stroke="#ff3b12" strokeWidth="1.5" className="animate-ping origin-center" />
              <circle cx="1180" cy="1800" r="11" fill="none" stroke="#ff3b12" strokeWidth="1.5" />
              <circle cx="1180" cy="1800" r="4" fill="#ff3b12" />
            </svg>

            {/* Monospace Telemetry Labels positioned around the bulb */}
            <div className="absolute top-[28%] right-2 sm:right-6 font-mono text-xs sm:text-sm tracking-[0.15em] text-[#11100f] uppercase font-bold">
              INTENT
            </div>
            <div className="absolute top-[52%] right-2 sm:right-6 font-mono text-xs sm:text-sm tracking-[0.15em] text-[#66625b] uppercase">
              INTERACTION
            </div>
            <div className="absolute top-[75%] right-2 sm:right-6 font-mono text-xs sm:text-sm tracking-[0.15em] text-[#66625b] uppercase">
              SYSTEM
            </div>
          </div>
        </div>

        {/* Bottom Center Scroll Pill */}
        <div className="w-full flex items-center justify-center pt-8 opacity-40">
          <div className="w-4 h-7 border border-black/30 rounded-full flex items-start justify-center p-1">
            <div className="w-1 h-1.5 bg-black/60 rounded-full animate-bounce" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. THE 3 ARCHITECTURAL CARDS                             */}
      {/* ======================================================== */}
      <div className="w-full max-w-[1360px] mx-auto px-6 sm:px-10 lg:px-14 py-16 sm:py-24 border-t border-black/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {HOW_IT_WORKS_STEPS.map((step, idx) => (
            <div
              key={step.step}
              className="flex flex-col justify-between p-8 bg-[#e6e3da] border border-black/10 transition-colors duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <span className="font-mono text-sm tracking-widest uppercase font-bold text-[#66625b]">
                    {step.step} / PHASE
                  </span>
                  <div className="p-3 bg-white/60 border border-black/10">
                    {icons[idx]}
                  </div>
                </div>

                <h3 className="font-archivo font-bold text-2xl md:text-3xl tracking-tight text-[#11100f] uppercase mb-4">
                  {step.title}
                </h3>

                <p className="font-sans text-base text-[#66625b] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
