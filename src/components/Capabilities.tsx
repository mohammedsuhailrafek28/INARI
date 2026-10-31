import React, { useEffect, useRef, useState } from 'react';

interface CapabilityItem {
  angle: number;
  leftPct: number;
  topPct: number;
  title: string;
  desc: string;
  threshold: number;
}

const PRODUCT_CAPABILITIES: CapabilityItem[] = [
  {
    angle: 0.707,
    leftPct: 17.5,
    topPct: 12,
    title: 'Product Strategy',
    desc: 'Find the right problem to solve.',
    threshold: 0.12,
  },
  {
    angle: 1.181,
    leftPct: 3.75,
    topPct: 31,
    title: 'UX Research',
    desc: 'Understand people before shaping solutions.',
    threshold: 0.30,
  },
  {
    angle: 1.571,
    leftPct: 0,
    topPct: 50,
    title: 'Interaction Design',
    desc: 'Make every action feel clear and natural.',
    threshold: 0.48,
  },
  {
    angle: 1.961,
    leftPct: 3.75,
    topPct: 69,
    title: 'Design Systems',
    desc: 'Build consistency that grows with the product.',
    threshold: 0.66,
  },
  {
    angle: 2.434,
    leftPct: 17.5,
    topPct: 88,
    title: 'Prototyping',
    desc: 'Make ideas tangible. Test what matters.',
    threshold: 0.82,
  },
];

const AI_CAPABILITIES: CapabilityItem[] = [
  {
    angle: 0.707,
    leftPct: 82.5,
    topPct: 12,
    title: 'AI Products',
    desc: 'Turn intelligence into useful experiences.',
    threshold: 0.12,
  },
  {
    angle: 1.181,
    leftPct: 96.25,
    topPct: 31,
    title: 'Agentic Systems',
    desc: 'Multi agent orchestration with clear roles and handoffs.',
    threshold: 0.30,
  },
  {
    angle: 1.571,
    leftPct: 100,
    topPct: 50,
    title: 'MCP',
    desc: 'Connect models to the tools they need.',
    threshold: 0.48,
  },
  {
    angle: 1.961,
    leftPct: 96.25,
    topPct: 69,
    title: 'RAG',
    desc: 'Ground responses in relevant knowledge.',
    threshold: 0.66,
  },
  {
    angle: 2.434,
    leftPct: 82.5,
    topPct: 88,
    title: 'Automation',
    desc: 'Turn repeated work into reliable workflows.',
    threshold: 0.82,
  },
];

export const Capabilities: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(900);
  const [secTop, setSecTop] = useState(0);
  const [orbitMetrics, setOrbitMetrics] = useState({ top: 0, height: 800 });

  useEffect(() => {
    const updateMetrics = () => {
      setScrollY(window.scrollY);
      setViewportH(window.innerHeight || 900);
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        setSecTop(rect.top + window.scrollY);
      }
      if (orbitRef.current) {
        const rect = orbitRef.current.getBoundingClientRect();
        setOrbitMetrics({ top: rect.top + window.scrollY, height: rect.height });
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

  // Kinetic headline drift
  const relSecScroll = Math.max(0, scrollY - secTop + 350);
  const driftVelocity = 0.15;
  const line1Drift = -relSecScroll * driftVelocity;
  const line2Drift = relSecScroll * driftVelocity;
  const line3Drift = -relSecScroll * driftVelocity;

  // Viewport center line for scroll tracking
  const scrollCursor = scrollY + viewportH * 0.45;

  // 1. Entry hairpin thread progress: draws across the top into (500, 0)
  const entryStart = secTop - 250;
  const entryEnd = orbitMetrics.top - 80;
  const entryProgress = Math.min(
    1,
    Math.max(0, (scrollCursor - entryStart) / Math.max(1, entryEnd - entryStart))
  );

  // 2. Orbit progression: as user scrolls down through the orbit height
  const orbitStart = orbitMetrics.top - 80;
  const orbitEnd = orbitMetrics.top + orbitMetrics.height * 0.95;
  const orbitProgress = Math.min(
    1,
    Math.max(0, (scrollCursor - orbitStart) / Math.max(1, orbitEnd - orbitStart))
  );

  // 3. Exit thread progression: draws straight down below the orbit
  const exitStart = orbitEnd;
  const exitProgress = Math.min(
    1,
    Math.max(0, (scrollCursor - exitStart) / 250)
  );

  // Path constants
  const HAIRPIN_LEN = 2200;
  const ARC_LEN = 1571;
  const EXIT_LEN = 300;

  const entryDashoffset = HAIRPIN_LEN * (1 - entryProgress);
  const leftDashoffset = ARC_LEN * (1 - orbitProgress);
  const rightDashoffset = ARC_LEN * (1 - orbitProgress);
  const exitDashoffset = EXIT_LEN * (1 - exitProgress);

  const splitReached = entryProgress >= 0.95;
  const mergeReached = orbitProgress >= 0.95;

  return (
    <section
      ref={sectionRef}
      id="capabilities"
      className="capabilities thread-scene relative w-full bg-[#050505] text-[#f1eee6] overflow-hidden pt-20 sm:pt-28 pb-32 sm:pb-44 z-10"
      aria-labelledby="capabilities-title"
    >
      {/* ======================================================== */}
      {/* 1. MAMMOTH KINETIC HEADLINE (3 LINES)                    */}
      {/* ======================================================== */}
      <div className="capability-heading w-full px-4 sm:px-8 lg:px-12 mb-16 sm:mb-24">
        <h2
          id="capabilities-title"
          className="font-archivo font-[800] uppercase text-[clamp(2.6rem,7.4vw,8.8rem)] leading-[0.98] tracking-[-0.065em] select-none"
        >
          {/* Line 1: drifts left */}
          <span className="block overflow-hidden py-1">
            <span
              className="capability-line block whitespace-nowrap will-change-transform"
              style={{
                transform: `translate3d(${line1Drift}px, 0, 0)`,
                transition: 'transform 0.05s ease-out',
              }}
            >
              I DESIGN THE EXPERIENCE.
            </span>
          </span>

          {/* Line 2: drifts right */}
          <span className="block overflow-hidden py-1">
            <span
              className="capability-line block whitespace-nowrap will-change-transform"
              style={{
                transform: `translate3d(${line2Drift}px, 0, 0)`,
                transition: 'transform 0.05s ease-out',
              }}
            >
              AND THE INTELLIGENCE
            </span>
          </span>

          {/* Line 3: drifts left, colored Vermilion (#ff3b12) */}
          <span className="block overflow-hidden py-1 text-[#ff3b12]">
            <span
              className="capability-line block whitespace-nowrap will-change-transform"
              style={{
                transform: `translate3d(${line3Drift}px, 0, 0)`,
                transition: 'transform 0.05s ease-out',
              }}
            >
              BEHIND IT.
            </span>
          </span>
        </h2>
      </div>

      {/* ======================================================== */}
      {/* 2. THE CAPABILITY ORBIT STAGE (WITH INTEGRATED SVG)      */}
      {/* ======================================================== */}
      <div
        ref={orbitRef}
        className="capability-orbit relative mx-auto w-[92%] sm:w-[80%] md:w-[68%] lg:w-[54%] max-w-[840px] h-[640px] sm:h-[720px] md:h-[800px] lg:h-[880px] mt-28 sm:mt-36"
      >
        {/* Top Split Junction Dot (at x: 50%, y: 0%) */}
        <div
          className={`capability-junction capability-split absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
            splitReached ? 'opacity-100 scale-100' : 'opacity-25 scale-75'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="overflow-visible">
            <circle cx="7" cy="7" r="4.5" fill="#ff3b12" />
            <circle
              cx="7"
              cy="7"
              r="8"
              fill="none"
              stroke="#ff3b12"
              strokeWidth="1.2"
              className={splitReached ? 'animate-ping opacity-60 origin-center' : 'opacity-0'}
            />
          </svg>
        </div>

        {/* Master Thread SVG: Entry Hairpin + Left/Right Ellipse Arcs + Exit Line */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Subtle guide tracks for ellipse */}
          <path
            d="M 500 0 A 500 500 0 0 0 500 1000"
            fill="none"
            stroke="#ff3b12"
            strokeWidth="1"
            strokeOpacity="0.12"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M 500 0 A 500 500 0 0 1 500 1000"
            fill="none"
            stroke="#ff3b12"
            strokeWidth="1"
            strokeOpacity="0.12"
            vectorEffect="non-scaling-stroke"
          />

          {/* 1. Entry Hairpin: enters from top right, loops around left, centers into apex */}
          <path
            d="M 960 -320 L 960 -180 Q 960 -150 920 -150 L 60 -150 A 35 35 0 0 0 60 -80 L 460 -80 Q 500 -80 500 -40 L 500 0"
            fill="none"
            stroke="#ff3b12"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={HAIRPIN_LEN}
            strokeDashoffset={entryDashoffset}
            className="transition-all duration-75 ease-out"
          />

          {/* 2. Left Arc (sweeps through Product Design nodes) */}
          <path
            d="M 500 0 A 500 500 0 0 0 500 1000"
            fill="none"
            stroke="#ff3b12"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={leftDashoffset}
            className="transition-all duration-75 ease-out"
          />

          {/* 3. Right Arc (sweeps through AI Systems nodes) */}
          <path
            d="M 500 0 A 500 500 0 0 1 500 1000"
            fill="none"
            stroke="#ff3b12"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={ARC_LEN}
            strokeDashoffset={rightDashoffset}
            className="transition-all duration-75 ease-out"
          />

          {/* 4. Exit Thread: drops straight down below bottom merge junction */}
          <path
            d="M 500 1000 L 500 1300"
            fill="none"
            stroke="#ff3b12"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={EXIT_LEN}
            strokeDashoffset={exitDashoffset}
            className="transition-all duration-75 ease-out"
          />
        </svg>

        {/* Left Discipline: PRODUCT DESIGN */}
        <div className="capability-discipline capability-product absolute inset-0">
          <h3
            className={`font-mono text-xs sm:text-sm font-bold tracking-[0.16em] text-[#f1eee6] uppercase whitespace-nowrap absolute -top-10 sm:-top-12 right-[86%] transition-opacity duration-300 ${
              splitReached ? 'opacity-100' : 'opacity-20'
            }`}
          >
            PRODUCT DESIGN
          </h3>

          <ul className="m-0 p-0 list-none">
            {PRODUCT_CAPABILITIES.map((item, idx) => {
              const reached = orbitProgress >= item.threshold;
              return (
                <li
                  key={idx}
                  data-capability-angle={item.angle}
                  data-thread-reached={reached ? 'true' : undefined}
                  style={{ left: `${item.leftPct}%`, top: `${item.topPct}%` }}
                  className="absolute w-0 h-0"
                >
                  {/* Concentric Node Dot on Ellipse */}
                  <svg
                    className="capability-dot absolute -top-[9px] -left-[9px] overflow-visible"
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="9" r="7" fill="#050505" stroke="#ff3b12" strokeWidth="1.3" />
                    <circle
                      className="capability-core transition-opacity duration-200"
                      cx="9"
                      cy="9"
                      r="2.5"
                      fill="#ff3b12"
                      opacity={reached ? 1 : 0.25}
                    />
                  </svg>

                  {/* Text Label: right-aligned, sitting outside the left arc */}
                  <span
                    className="absolute top-0 right-6 sm:right-8 -translate-y-1/2 w-[180px] sm:w-[220px] md:w-[260px] text-right pointer-events-auto"
                    style={{
                      opacity: reached ? 1 : 0.15,
                      filter: reached ? 'blur(0px)' : 'blur(8px)',
                      transform: reached ? 'translateY(-50%)' : 'translateY(-30%)',
                      transition: 'opacity 0.5s cubic-bezier(0.215, 0.61, 0.355, 1), filter 0.5s ease-out, transform 0.5s ease-out',
                    }}
                  >
                    <strong className="block font-mono text-xs sm:text-sm md:text-base font-normal text-[#f1eee6] tracking-tight">
                      {item.title}
                    </strong>
                    <small className="block font-sans text-[11px] sm:text-xs md:text-sm text-[#999388] leading-snug mt-1 text-balance">
                      {item.desc}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Discipline: AI SYSTEMS */}
        <div className="capability-discipline capability-ai absolute inset-0">
          <h3
            className={`font-mono text-xs sm:text-sm font-bold tracking-[0.16em] text-[#f1eee6] uppercase whitespace-nowrap absolute -top-10 sm:-top-12 left-[86%] transition-opacity duration-300 ${
              splitReached ? 'opacity-100' : 'opacity-20'
            }`}
          >
            AI SYSTEMS
          </h3>

          <ul className="m-0 p-0 list-none">
            {AI_CAPABILITIES.map((item, idx) => {
              const reached = orbitProgress >= item.threshold;
              return (
                <li
                  key={idx}
                  data-capability-angle={item.angle}
                  data-thread-reached={reached ? 'true' : undefined}
                  style={{ left: `${item.leftPct}%`, top: `${item.topPct}%` }}
                  className="absolute w-0 h-0"
                >
                  {/* Concentric Node Dot on Ellipse */}
                  <svg
                    className="capability-dot absolute -top-[9px] -left-[9px] overflow-visible"
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    aria-hidden="true"
                  >
                    <circle cx="9" cy="9" r="7" fill="#050505" stroke="#ff3b12" strokeWidth="1.3" />
                    <circle
                      className="capability-core transition-opacity duration-200"
                      cx="9"
                      cy="9"
                      r="2.5"
                      fill="#ff3b12"
                      opacity={reached ? 1 : 0.25}
                    />
                  </svg>

                  {/* Text Label: left-aligned, sitting outside the right arc */}
                  <span
                    className="absolute top-0 left-6 sm:left-8 -translate-y-1/2 w-[180px] sm:w-[220px] md:w-[260px] text-left pointer-events-auto"
                    style={{
                      opacity: reached ? 1 : 0.15,
                      filter: reached ? 'blur(0px)' : 'blur(8px)',
                      transform: reached ? 'translateY(-50%)' : 'translateY(-30%)',
                      transition: 'opacity 0.5s cubic-bezier(0.215, 0.61, 0.355, 1), filter 0.5s ease-out, transform 0.5s ease-out',
                    }}
                  >
                    <strong className="block font-mono text-xs sm:text-sm md:text-base font-normal text-[#f1eee6] tracking-tight">
                      {item.title}
                    </strong>
                    <small className="block font-sans text-[11px] sm:text-xs md:text-sm text-[#999388] leading-snug mt-1 text-balance">
                      {item.desc}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bottom Merge Junction Dot (at x: 50%, y: 100%) */}
        <div
          className={`capability-junction capability-merge absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
            mergeReached ? 'opacity-100 scale-100' : 'opacity-20 scale-75'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="overflow-visible">
            <circle cx="7" cy="7" r="4.5" fill="#ff3b12" />
            <circle
              cx="7"
              cy="7"
              r="8"
              fill="none"
              stroke="#ff3b12"
              strokeWidth="1.2"
              className={mergeReached ? 'animate-ping opacity-60 origin-center' : 'opacity-0'}
            />
          </svg>
        </div>
      </div>
    </section>
  );
};
