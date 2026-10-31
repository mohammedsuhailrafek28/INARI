import React, { useEffect, useState } from 'react';

export const Hero: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parallax velocity shift during scroll (matching dakshgajjar velocity factor)
  // Line 1: moves LEFT
  // Line 2: moves RIGHT (opposite direction)
  // Line 3: moves LEFT
  const velocityFactor = 0.088;
  const line1X = -scrollY * velocityFactor;
  const line2X = scrollY * velocityFactor;
  const line3X = -scrollY * velocityFactor;

  return (
    <section className="hero relative min-h-[100svh] w-full flex flex-col justify-between px-6 sm:px-10 lg:px-14 pb-8 sm:pb-12 bg-[#050505] text-[#f1eee6] overflow-hidden select-none">
      {/* ======================================================== */}
      {/* 1. BACK THREAD SVG LAYER (z-index: 3, weaves BEHIND text) */}
      {/* ======================================================== */}
      <svg
        className="hero-thread-layer hero-thread-back pointer-events-none absolute inset-0 w-full h-full z-[3] overflow-visible"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g stroke="#ff3b12" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Segment 0: Top-left origin curving down across line 1 */}
          <path
            d="M 90.72 86 C 124.59 198.73, 215.55 249.85, 453.59 287.83"
            className="hero-thread-path"
          />
          {/* Segment 2: Loop sweeping behind line 2 */}
          <path
            d="M 427.36 339.70 C 371.63 368.58, 277.02 399.52, 165.80 433.23"
            className="hero-thread-path"
          />
          {/* Segment 4: Sweep down-left behind line 2/3 */}
          <path
            d="M 95.27 454.40 C 52.31 467.19, 27.79 496.24, 27.79 522.08"
            className="hero-thread-path"
          />
          {/* Segment 6: Loop around the end of line 3 */}
          <path
            d="M 943.95 570.57 C 1131.05 570.57, 1173.11 558.16, 1161.51 637.03"
            className="hero-thread-path"
          />
          {/* Segment 8: Return vertical loop */}
          <path
            d="M 1012.31 639.95 C 1012.31 623.89, 1086.10 619.50, 1086.10 642.87 L 1086.10 721.75"
            className="hero-thread-path"
          />
          {/* Segment 9: Bottom-right curly flourish */}
          <path
            d="M 1086.10 721.75 C 1080.26 733.43, 1097.78 736.35, 1080.26 745.12 S 1087.56 761.18, 1067.11 768.49 S 1068.57 784.55, 1052.50 796.24"
            className="hero-thread-path"
          />
          {/* Segment 10 (tail connecting to next world) */}
          <path
            d="M 1052.50 796.24 C 1036.44 807.92, 1046.52 846.45, 1046.52 879.92"
            className="hero-thread-path"
            strokeDasharray="4 6"
            strokeOpacity="0.4"
          />
        </g>

        {/* Origin Head Dot at (90.72, 86) */}
        <circle cx="90.72" cy="86" r="4.5" fill="#ff3b12" filter="drop-shadow(0 0 6px #ff3b12)" />

        {/* Pulsing Concentric Ring & Dot at (1052.5, 796.24) */}
        <circle
          cx="1052.50"
          cy="796.24"
          r="12"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="1.5"
          className="animate-ping origin-center"
          style={{ transformOrigin: '1052.5px 796.24px' }}
        />
        <circle cx="1052.50" cy="796.24" r="11" fill="none" stroke="#ff3b12" strokeWidth="1.5" />
        <circle cx="1052.50" cy="796.24" r="4" fill="#ff3b12" />
      </svg>

      {/* ======================================================== */}
      {/* 2. HERO COPY & 3 KINETIC DISPLAY LINES (z-index: 4)      */}
      {/* ======================================================== */}
      <div className="hero-copy relative z-[4] flex-1 flex flex-col justify-between pt-24 sm:pt-28 md:pt-32">
        <h1
          id="hero-title"
          className="hero-title font-archivo font-[850] text-[clamp(3.8rem,13.2vw,12.5rem)] leading-[0.80] tracking-[-0.065em] uppercase text-[#f1eee6] my-auto"
        >
          {/* Line 1: Shifts LEFT on scroll */}
          <span className="hero-line-reveal block overflow-visible">
            <span
              className="hero-line block whitespace-nowrap will-change-transform"
              style={{
                transform: `translate3d(${line1X}px, 0, 0)`,
                transition: 'transform 0.04s linear',
              }}
            >
              I DESIGN
            </span>
          </span>

          {/* Line 2: Shifts RIGHT on scroll (REVERSE DIRECTION) */}
          <span className="hero-line-reveal block overflow-visible">
            <span
              className="hero-line block whitespace-nowrap will-change-transform"
              style={{
                transform: `translate3d(${line2X}px, 0, 0)`,
                transition: 'transform 0.04s linear',
              }}
            >
              MONEY
            </span>
          </span>

          {/* Line 3: Shifts LEFT on scroll */}
          <span className="hero-line-reveal block overflow-visible">
            <span
              className="hero-line hero-line-last block whitespace-nowrap will-change-transform"
              style={{
                transform: `translate3d(${line3X}px, 0, 0)`,
                transition: 'transform 0.04s linear',
              }}
            >
              THAT THINKS.
            </span>
          </span>
        </h1>

        {/* ======================================================== */}
        {/* 3. HERO FOOTER BAR (Support Description, Cue, Arrow)     */}
        {/* ======================================================== */}
        <div className="hero-footer w-full flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pt-6 pb-2 border-t border-white/5">
          {/* Left Description: Monospace 2-line statement matching screenshot */}
          <div className="hero-support max-w-lg">
            <p className="font-mono text-xs sm:text-sm text-[#aaa79f] leading-relaxed">
              Personal finance coach working across digital experiences,
              living money models and intelligent financial systems.
            </p>
          </div>

          {/* Center Scroll Pill Indicator */}
          <div className="hidden md:flex items-center justify-center">
            <div className="w-5 h-8 border border-white/20 rounded-full flex items-start justify-center p-1.5 opacity-60">
              <div className="w-1 h-2 bg-white/60 rounded-full animate-bounce" />
            </div>
          </div>

          {/* Right Scroll Cue with Down Arrow */}
          <a
            href="#architecture"
            className="scroll-cue font-mono text-[11px] sm:text-xs text-[#f1eee6] hover:text-[#ff3b12] uppercase tracking-[0.1em] flex items-center gap-2 group transition-colors"
          >
            <span>SCROLL TO FOLLOW THE THREAD</span>
            <span className="text-[#ff3b12] transform group-hover:translate-y-1 transition-transform">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v18m-8-8 8 8 8-8" />
              </svg>
            </span>
          </a>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. FRONT THREAD SVG LAYER (z-index: 5, weaves OVER text) */}
      {/* ======================================================== */}
      <svg
        className="hero-thread-layer hero-thread-front pointer-events-none absolute inset-0 w-full h-full z-[5] overflow-visible"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g stroke="#ff3b12" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Segment 1: Loops OVER line 1 into line 2 */}
          <path
            d="M 453.59 287.83 C 464.30 289.53, 487.27 295.13, 466.54 314.12 C 457.42 322.47, 444.16 330.99, 427.36 339.70"
            className="hero-thread-path"
          />
          {/* Segment 3: Crosses OVER line 2 */}
          <path
            d="M 165.80 433.23 C 142.93 440.17, 119.35 447.22, 95.27 454.40"
            className="hero-thread-path"
          />
          {/* Segment 5: Sweeps horizontally OVER line 2/3 divide */}
          <path
            d="M 27.79 522.08 C 27.79 547.93, 52.31 570.57, 107.45 570.57 H 943.95"
            className="hero-thread-path"
          />
          {/* Segment 7: Loops OVER line 3 end */}
          <path
            d="M 1161.51 637.03 C 1149.91 715.90, 992.99 714.44, 1012.31 639.95"
            className="hero-thread-path"
          />
        </g>
      </svg>
    </section>
  );
};
