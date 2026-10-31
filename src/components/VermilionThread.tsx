import React, { useEffect, useState } from 'react';

export const VermilionThread: React.FC = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll <= 0) return;
      const currentScroll = window.scrollY;
      const progress = Math.min(Math.max(currentScroll / totalScroll, 0), 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Compute a vertical indicator position along the right edge of the screen
  const needleY = Math.max(10, Math.min(90, scrollProgress * 100));

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden" aria-hidden="true">
      {/* Background subtle full-page spline indicator line along right margin */}
      <svg
        className="absolute top-0 right-4 sm:right-8 md:right-12 h-full w-24 overflow-visible"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="threadGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff3b12" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff3b12" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Static faint guide track */}
        <path
          d="M 50 0 C 40 250, 60 500, 50 750 C 45 880, 55 950, 50 1000"
          fill="none"
          stroke="rgba(255, 59, 18, 0.15)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />

        {/* Active traced vermilion spline that grows with scroll */}
        <path
          d="M 50 0 C 40 250, 60 500, 50 750 C 45 880, 55 950, 50 1000"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="2.5"
          strokeDasharray="1000"
          strokeDashoffset={1000 * (1 - scrollProgress)}
          filter="url(#glowFilter)"
        />
      </svg>

      {/* Floating pulsating needle head riding the active scroll depth */}
      <div
        className="absolute right-4 sm:right-8 md:right-12 transition-all duration-100 ease-out flex items-center justify-center -translate-x-[42px]"
        style={{ top: `${needleY}vh` }}
      >
        <div className="relative flex items-center justify-center">
          {/* Pulsing beacon waves */}
          <span className="absolute w-8 h-8 rounded-full bg-thread/30 animate-ping" />
          <span className="absolute w-5 h-5 rounded-full bg-thread/40" />
          {/* Core needle dot */}
          <span className="w-2.5 h-2.5 rounded-full bg-thread shadow-[0_0_12px_#ff3b12]" />
          
          {/* Micro telemetry tag visible on larger screens */}
          <span className="hidden lg:block absolute right-6 font-mono text-[9px] uppercase tracking-wider text-thread whitespace-nowrap bg-canvas-dark/80 px-1.5 py-0.5 border border-thread/30">
            {Math.round(scrollProgress * 100)}% STREAM
          </span>
        </div>
      </div>
    </div>
  );
};

