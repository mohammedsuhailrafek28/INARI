import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BrandEmblem } from "@/components/brand/BrandMark";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  FileText,
  GitBranch,
  Lock,
  Menu,
  Shield,
  ShieldCheck,
  Terminal,
  Wallet,
  X,
  Zap,
} from "lucide-react";


const THREAD_PATHS = {
  hero: "M 90.72 86 C 124.59 198.73, 215.55 249.85, 453.59 287.83 C 464.30 289.53, 487.27 295.13, 466.54 314.12 C 457.42 322.47, 444.16 330.99, 427.36 339.70 C 371.63 368.58, 277.02 399.52, 165.80 433.23 C 142.93 440.17, 119.35 447.22, 95.27 454.40 C 52.31 467.19, 27.79 496.24, 27.79 522.08 C 27.79 547.93, 52.31 570.57, 107.45 570.57 H 943.95 C 1131.05 570.57, 1173.11 558.16, 1161.51 637.03 C 1149.91 715.90, 992.99 714.44, 1012.31 639.95 C 1012.31 623.89, 1086.10 619.50, 1086.10 642.87 L 1086.10 721.75 C 1080.26 733.43, 1097.78 736.35, 1080.26 745.12 S 1087.56 761.18, 1067.11 768.49 S 1068.57 784.55, 1052.50 796.24 C 1036.44 807.92, 1046.52 846.45, 1046.52 900.00",
  ingestion: "M 1046.52 0 C 1046.52 120, 1180 200, 1180 340 C 1180 480, 850 480, 850 620 C 850 760, 720 860, 720 1000",
  scenariosPrimary: "M 720 0 C 720 150, 480 250, 480 500 C 480 750, 720 850, 720 1000",
  scenariosSecondary: "M 720 0 C 720 150, 960 250, 960 500 C 960 750, 720 850, 720 1000",
  buffer: "M 720 0 C 720 200, 320 280, 320 500 C 320 720, 720 800, 720 1000",
  waterfall: "M 720 0 C 720 200, 1100 280, 1100 500 C 1100 720, 720 800, 720 1000",
  nudges: "M 720 0 C 720 180, 400 250, 400 500 C 400 750, 720 820, 720 1000",
  review: "M 720 0 C 720 200, 980 250, 980 500 C 980 750, 720 850, 720 1000",
  mandate: "M 720 0 C 720 200, 1050 250, 1050 500 C 1050 750, 720 850, 720 1000",
  faq: "M 720 0 C 720 250, 720 450, 720 650 C 720 750, 720 820, 720 900",
};

interface SectionThreadProps {
  id: string;
  pathD: string;
  secondaryPathD?: string;
  viewBox?: string;
  checkpoint?: { x: number; y: number; threshold?: number };
  isHero?: boolean;
  isTerminal?: boolean;
  progress: number;
  prefersReducedMotion?: boolean;
}

function SectionThread({
  id,
  pathD,
  secondaryPathD,
  viewBox = "0 0 1440 1000",
  checkpoint,
  isHero = false,
  isTerminal = false,
  progress,
  prefersReducedMotion = false,
}: SectionThreadProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [totalLength, setTotalLength] = useState(2500);
  const [endpoint, setEndpoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      if (len > 0) {
        setTotalLength(len);
        const pt = pathRef.current.getPointAtLength(0);
        setEndpoint({ x: pt.x, y: pt.y });
      }
    }
  }, [pathD]);

  useEffect(() => {
    if (pathRef.current && totalLength > 0) {
      const effectiveProgress = prefersReducedMotion ? 1 : progress;
      const targetLength = Math.max(0, Math.min(totalLength, effectiveProgress * totalLength));
      const pt = pathRef.current.getPointAtLength(targetLength);
      setEndpoint({ x: pt.x, y: pt.y });
    }
  }, [progress, totalLength, prefersReducedMotion]);

  const effectiveProgress = prefersReducedMotion ? 1 : progress;
  const strokeDashoffset = totalLength * (1 - effectiveProgress);
  const isActive = effectiveProgress > 0 && effectiveProgress < 1;
  const isReached = effectiveProgress >= (checkpoint?.threshold ?? 0.5);

  return (
    <svg
      id={id}
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[10]"
      viewBox={viewBox}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id={`threadGlow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Translucent Guide Track (Watermark) */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(201, 161, 90, 0.16)"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        vectorEffect="non-scaling-stroke"
      />

      {/* Secondary bifurcation track if present */}
      {secondaryPathD && (
        <>
          <path
            d={secondaryPathD}
            fill="none"
            stroke="rgba(201, 161, 90, 0.12)"
            strokeWidth="1.2"
            strokeDasharray="3 6"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={secondaryPathD}
            fill="none"
            stroke="#C49A4A"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            strokeOpacity="0.45"
            vectorEffect="non-scaling-stroke"
            style={{
              strokeDasharray: totalLength,
              strokeDashoffset,
              transition: prefersReducedMotion ? "none" : "stroke-dashoffset 0.05s linear",
            }}
          />
        </>
      )}

      {/* Active Living Drawn Thread */}
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="#C49A4A"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{
          strokeDasharray: totalLength,
          strokeDashoffset,
          transition: prefersReducedMotion ? "none" : "stroke-dashoffset 0.05s linear",
        }}
        filter={`url(#threadGlow-${id})`}
      />

      {/* Hero Origin Dot */}
      {isHero && (
        <circle
          cx="90.72"
          cy="86"
          r="4.5"
          fill="#C49A4A"
          filter="drop-shadow(0 0 6px #C49A4A)"
        />
      )}

      {/* Checkpoint Anchor Dot */}
      {checkpoint && (
        <g>
          <circle
            cx={checkpoint.x}
            cy={checkpoint.y}
            r="14"
            fill="none"
            stroke="#C49A4A"
            strokeWidth="1.2"
            className={isReached && !prefersReducedMotion ? "animate-ping origin-center" : "opacity-0"}
            style={{
              transformOrigin: `${checkpoint.x}px ${checkpoint.y}px`,
              opacity: isReached ? 0.75 : 0,
            }}
          />
          <circle
            cx={checkpoint.x}
            cy={checkpoint.y}
            r="10"
            fill="none"
            stroke="#C49A4A"
            strokeWidth="1.2"
            style={{
              opacity: isReached ? 0.6 : 0.2,
              transition: "opacity 0.3s ease",
            }}
          />
          <circle
            cx={checkpoint.x}
            cy={checkpoint.y}
            r="4.5"
            fill={isReached ? "#C49A4A" : "rgba(212, 175, 55, 0.3)"}
            filter={isReached ? "drop-shadow(0 0 6px #C49A4A)" : undefined}
            style={{ transition: "all 0.3s ease" }}
          />
        </g>
      )}

      {/* Moving Endpoint Bead */}
      {!prefersReducedMotion && (isActive || (isTerminal && effectiveProgress >= 1)) && (
        <g style={{ pointerEvents: "none" }}>
          <circle
            cx={endpoint.x}
            cy={endpoint.y}
            r="5"
            fill="#C49A4A"
            filter="drop-shadow(0 0 8px rgba(212, 175, 55, 1))"
          />
          <circle
            cx={endpoint.x}
            cy={endpoint.y}
            r="13"
            fill="none"
            stroke="#C49A4A"
            strokeWidth="1.5"
            className="animate-ping origin-center"
            style={{ transformOrigin: `${endpoint.x}px ${endpoint.y}px` }}
          />
          <circle
            cx={endpoint.x}
            cy={endpoint.y}
            r="11"
            fill="none"
            stroke="#C49A4A"
            strokeWidth="1.2"
            opacity="0.7"
          />
        </g>
      )}
    </svg>
  );
}

const faqData = [
  {
    question: "How does INARI differ from conventional budgeting applications?",
    answer:
      "Standard budgeting tools simply categorize transactions after money has already left your account and stop there. INARI builds a living money model — synthesizing messy bank statements into your true baseline burn, calculating dynamic runway, and simulating what-if scenarios so you see exactly how life decisions impact your future goals before you make them.",
  },
  {
    question: "Is my bank statement data private and secure?",
    answer:
      "100% private. INARI is built local-first. Raw statement parsing (PDF, CSV, SMS) happens securely in your personal instance without uploading financial transcripts to third-party ad networks or brokers. Your profile versions are stored in an immutable local database.",
  },
  {
    question: "How does the What-If simulation engine operate?",
    answer:
      "The scenario engine executes deterministic mathematical projections over configurable 24-to-60 month horizons. You can model lifestyle adjustments (e.g. cutting dining out by 30%), fixed cost shocks (e.g. a 10% rent hike), sabbaticals, or major one-off purchases. It computes exact goal arrival dates and runway changes without modifying your baseline profile until you explicitly save.",
  },
  {
    question: "Can I override and steer the auto-detected categories?",
    answer:
      "Yes. INARI uses an adaptive correction loop. If an auto-categorized merchant is misaligned, you can edit it once in the UI. INARI learns your personal classification rule and applies it consistently to all subsequent statements.",
  },
  {
    question: "Why does INARI strictly prohibit recommending investment products?",
    answer:
      "INARI is an educational financial coach, not a broker or affiliated seller. Traditional apps push high-commission mutual funds, credit cards, and crypto tokens. INARI eliminates conflict of interest: we model cash flow scenarios with pure deterministic Python math and never sell, solicit, or recommend specific securities.",
  },
  {
    question: 'What constitutes an "apparently unused" recurring subscription?',
    answer:
      "INARI correlates recurring merchant charges with related lifestyle telemetry in your statements (such as zero metro/fuel swipes to a gym location, zero active app activity, or prolonged dormancy). When a recurring payment occurs with no corresponding usage signal for over 45 days, INARI flags it for your review.",
  },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Section references for scroll progression tracking
  const heroRef = useRef<HTMLElement>(null);
  const ingestionRef = useRef<HTMLElement>(null);
  const scenariosRef = useRef<HTMLElement>(null);
  const bufferRef = useRef<HTMLElement>(null);
  const waterfallRef = useRef<HTMLElement>(null);
  const nudgesRef = useRef<HTMLElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const mandateRef = useRef<HTMLElement>(null);
  const faqRef = useRef<HTMLElement>(null);

  const [sectionProgress, setSectionProgress] = useState<{ [key: string]: number }>({
    hero: 0,
    ingestion: 0,
    scenarios: 0,
    buffer: 0,
    waterfall: 0,
    nudges: 0,
    review: 0,
    mandate: 0,
    faq: 0,
  });

  useEffect(() => {
    const prefersMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPrefersReducedMotion(prefersMotion);

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sy = window.scrollY;
          const vh = window.innerHeight;
          setScrollY(sy);

          // Get section elements
          const heroEl = heroRef.current;
          const ingestionEl = ingestionRef.current;
          const scenariosEl = scenariosRef.current;
          const bufferEl = bufferRef.current;
          const waterfallEl = waterfallRef.current;
          const nudgesEl = nudgesRef.current;
          const reviewEl = reviewRef.current;
          const mandateEl = mandateRef.current;
          const faqEl = faqRef.current;

          // Offsets
          const heroH = heroEl ? heroEl.offsetHeight : vh;
          const ingestionTop = ingestionEl ? ingestionEl.offsetTop : heroH;
          const scenariosTop = scenariosEl ? scenariosEl.offsetTop : ingestionTop + 1000;
          const bufferTop = bufferEl ? bufferEl.offsetTop : scenariosTop + 1000;
          const waterfallTop = waterfallEl ? waterfallEl.offsetTop : bufferTop + 1000;
          const nudgesTop = nudgesEl ? nudgesEl.offsetTop : waterfallTop + 1000;
          const reviewTop = reviewEl ? reviewEl.offsetTop : nudgesTop + 1000;
          const mandateTop = mandateEl ? mandateEl.offsetTop : reviewTop + 1000;
          const faqTop = faqEl ? faqEl.offsetTop : mandateTop + 1000;

          const offsetFocus = vh * 0.45;

          const s0_start = 0;
          const s0_end = Math.max(ingestionTop - offsetFocus, 200);

          const s1_start = s0_end;
          const s1_end = Math.max(scenariosTop - offsetFocus, s1_start + 1);

          const s2_start = s1_end;
          const s2_end = Math.max(bufferTop - offsetFocus, s2_start + 1);

          const s3_start = s2_end;
          const s3_end = Math.max(waterfallTop - offsetFocus, s3_start + 1);

          const s4_start = s3_end;
          const s4_end = Math.max(nudgesTop - offsetFocus, s4_start + 1);

          const s5_start = s4_end;
          const s5_end = Math.max(reviewTop - offsetFocus, s5_start + 1);

          const s6_start = s5_end;
          const s6_end = Math.max(mandateTop - offsetFocus, s6_start + 1);

          const s7_start = s6_end;
          const s7_end = Math.max(faqTop - offsetFocus, s7_start + 1);

          const s8_start = s7_end;
          const s8_end = Math.max(document.documentElement.scrollHeight - vh, s8_start + 1);

          const clamp = (val: number, min: number, max: number) =>
            Math.min(Math.max(val, min), max);

          setSectionProgress({
            hero: clamp((sy - s0_start) / (s0_end - s0_start), 0, 1),
            ingestion: clamp((sy - s1_start) / (s1_end - s1_start), 0, 1),
            scenarios: clamp((sy - s2_start) / (s2_end - s2_start), 0, 1),
            buffer: clamp((sy - s3_start) / (s3_end - s3_start), 0, 1),
            waterfall: clamp((sy - s4_start) / (s4_end - s4_start), 0, 1),
            nudges: clamp((sy - s5_start) / (s5_end - s5_start), 0, 1),
            review: clamp((sy - s6_start) / (s6_end - s6_start), 0, 1),
            mandate: clamp((sy - s7_start) / (s7_end - s7_start), 0, 1),
            faq: clamp((sy - s8_start) / (s8_end - s8_start), 0, 1),
          });

          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const parallaxOffset1 = -scrollY * 0.088;
  const parallaxOffset2 = scrollY * 0.088;
  const parallaxOffset3 = -scrollY * 0.088;

  return (
    <div className="inari-living relative min-h-screen bg-[#123C32] text-[#F3EFE4] selection:bg-[#C49A4A] selection:text-[#F3EFE4] font-sans overflow-x-hidden">
      {/* 1. TOP NAVIGATION BAR (Item 1: Logo of Inari, Item 6: All pages & Dashboard button) */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#123C32]/95 backdrop-blur border-b border-[#F3EFE4]/15 text-[#F3EFE4]">
        <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 h-20 sm:h-24 flex items-center justify-between">
          <a
            href="/"
            className="pointer-events-auto flex items-center gap-3 font-archivo font-[900] text-2xl sm:text-3xl tracking-tight uppercase text-[#F3EFE4] hover:text-[#C49A4A] transition-colors focus:outline-none"
            aria-label="INARI Home"
          >
            <BrandEmblem size={36} />
            <span>INARI</span>
          </a>

          <div className="flex items-center gap-4 sm:gap-6 pointer-events-auto">
            <nav className="hidden xl:flex items-center gap-6 font-mono text-[11px] sm:text-xs tracking-[0.14em] uppercase text-[#F3EFE4]/80">
              <a
                href="/dashboard"
                className="text-[#C49A4A] hover:text-[#F3EFE4] transition-colors font-bold flex items-center gap-1.5 border border-[#C49A4A]/40 px-3.5 py-1.5 rounded-full bg-[#C49A4A]/15 shadow-[0_0_15px_rgba(255,59,18,0.2)]"
              >
                <span>DASHBOARD</span>
                <span className="text-[10px]">⚡</span>
              </a>
              <a href="/import" className="hover:text-[#F3EFE4] transition-colors">
                Import
              </a>
              <a href="/spending" className="hover:text-[#F3EFE4] transition-colors">
                Spending
              </a>
              <a href="/goals" className="hover:text-[#F3EFE4] transition-colors">
                Goals
              </a>
              <a href="/recommendations" className="hover:text-[#F3EFE4] transition-colors">
                Scenarios
              </a>
              <a href="/avatar" className="hover:text-[#F3EFE4] transition-colors">
                Advisor
              </a>
              <a href="/support" className="hover:text-[#F3EFE4] transition-colors">
                Support
              </a>
              <a
                href="/inari"
                className="text-[#F3EFE4]/60 hover:text-[#F3EFE4] transition-colors flex items-center gap-1 font-bold"
              >
                <span>Studio</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </nav>

            {/* Quick Mobile/Tablet Dashboard Pill */}
            <a
              href="/dashboard"
              className="xl:hidden text-[#C49A4A] hover:text-[#F3EFE4] transition-colors font-mono text-[11px] font-bold flex items-center gap-1 border border-[#C49A4A]/40 px-3 py-1 rounded-full bg-[#C49A4A]/15"
            >
              <span>DASHBOARD</span>
              <span className="text-[10px]">⚡</span>
            </a>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="xl:hidden p-2 text-[#F3EFE4] hover:text-[#C49A4A] transition-colors focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#123C32]/98 backdrop-blur-xl xl:hidden flex flex-col justify-center px-8 py-16">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
            <BrandEmblem size={36} />
            <span className="font-archivo font-extrabold text-2xl text-[#F3EFE4]">INARI</span>
          </div>
          <nav className="flex flex-col gap-4 font-mono text-sm tracking-widest uppercase">
            <a
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#C49A4A] font-bold border-b border-[#C49A4A]/30 pb-3 flex items-center justify-between"
            >
              <span>GO TO DASHBOARD</span>
              <span>⚡</span>
            </a>
            <a
              href="/import"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/80 hover:text-[#C49A4A] border-b border-white/10 pb-3"
            >
              Statement Import
            </a>
            <a
              href="/spending"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/80 hover:text-[#C49A4A] border-b border-white/10 pb-3"
            >
              Spending Insights
            </a>
            <a
              href="/goals"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/80 hover:text-[#C49A4A] border-b border-white/10 pb-3"
            >
              Goal Planner
            </a>
            <a
              href="/recommendations"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/80 hover:text-[#C49A4A] border-b border-white/10 pb-3"
            >
              Scenarios &amp; Recommendations
            </a>
            <a
              href="/avatar"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/80 hover:text-[#C49A4A] border-b border-white/10 pb-3"
            >
              INARI Advisor
            </a>
            <a
              href="/support"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/80 hover:text-[#C49A4A] border-b border-white/10 pb-3"
            >
              Support &amp; FAQ
            </a>
            <a
              href="/inari"
              onClick={() => setMobileMenuOpen(false)}
              className="text-[#F3EFE4]/60 hover:text-[#F3EFE4] border-b border-white/10 pb-3 flex items-center justify-between"
            >
              <span>INARI Studio</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </nav>
        </div>
      )}

      <main id="main-content">
        {/* =========================================================================
            SECTION 0: HERO SECTION (Item 11: Header Changed, Item 2: Connected Threads)
           ========================================================================= */}
        <section ref={heroRef} className="hero relative min-h-[100svh] w-full flex flex-col justify-between px-6 sm:px-10 lg:px-14 pb-8 sm:pb-12 bg-[#123C32] text-[#F3EFE4] overflow-hidden select-none">
          {/* Living Thread Layer (Hero -> Ingestion) */}
          <SectionThread
            id="hero-thread"
            pathD={THREAD_PATHS.hero}
            viewBox="0 0 1440 900"
            isHero={true}
            checkpoint={{ x: 1052.5, y: 796.24, threshold: 0.88 }}
            progress={sectionProgress.hero}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Hero Copy (Item 11: Header Changed to INARI Living Money Model) */}
          <div className="hero-copy relative z-[4] flex-1 flex flex-col justify-between pt-24 sm:pt-28 md:pt-32">
            <h1
              id="hero-title"
              className="hero-title font-archivo font-[850] text-[clamp(2.2rem,11.4vw,10.6rem)] leading-[0.80] tracking-[-0.065em] uppercase text-[#F3EFE4] my-auto"
            >
              <span className="hero-line-reveal block overflow-visible">
                <span
                  className="hero-line block whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translate3d(${parallaxOffset1}px, 0, 0)`,
                    transition: "transform 0.04s linear",
                  }}
                >
                  A LIVING
                </span>
              </span>
              <span className="hero-line-reveal block overflow-visible">
                <span
                  className="hero-line block whitespace-nowrap will-change-transform"
                  style={{
                    transform: `translate3d(${parallaxOffset2}px, 0, 0)`,
                    transition: "transform 0.04s linear",
                  }}
                >
                  MONEY MODEL
                </span>
              </span>
              <span className="hero-line-reveal block overflow-visible">
                <span
                  className="hero-line hero-line-last block whitespace-nowrap will-change-transform text-transparent bg-clip-text bg-gradient-to-r from-[#C49A4A] to-[#C49A4A]"
                  style={{
                    transform: `translate3d(${parallaxOffset3}px, 0, 0)`,
                    transition: "transform 0.04s linear",
                  }}
                >
                  THAT ADAPTS.
                </span>
              </span>
            </h1>

            <div className="hero-footer w-full flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 pt-6 pb-2 border-t border-white/10">
              <div className="hero-support max-w-xl">
                <p className="font-mono text-xs sm:text-sm text-[#B9C4B3] leading-relaxed">
                  INARI synthesizes raw bank statements into a living money model. Track
                  non-negotiable fixed burn, stress-test life what-ifs, and navigate your liquid
                  runway with deterministic mathematical clarity.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/dashboard"
                    className="font-mono text-xs tracking-wider uppercase font-bold bg-[#C49A4A] text-[#F3EFE4] px-5 py-2.5 hover:bg-[#A63A28] transition-all flex items-center gap-2"
                  >
                    <span>Open Dashboard</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="/import"
                    className="font-mono text-xs tracking-wider uppercase font-bold border border-white/20 hover:border-white text-[#F3EFE4] px-5 py-2.5 transition-colors flex items-center gap-2"
                  >
                    <span>Import Statement</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center">
                <div className="w-5 h-8 border border-white/20 rounded-full flex items-start justify-center p-1.5 opacity-60">
                  <div className="w-1 h-2 bg-white/60 rounded-full animate-bounce" />
                </div>
              </div>

              <a
                href="#ingestion"
                className="scroll-cue font-mono text-[11px] sm:text-xs text-[#F3EFE4] hover:text-[#C49A4A] uppercase tracking-[0.1em] flex items-center gap-2 group transition-colors"
              >
                <span>SCROLL TO FOLLOW THE THREAD</span>
                <span className="text-[#C49A4A] transform group-hover:translate-y-1 transition-transform">
                  ↓
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 1: STATEMENT INGESTION (Item 8: Header removed, Item 7.1: Link removed)
           ========================================================================= */}
        <section
          ref={ingestionRef}
          id="ingestion"
          className="relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#F3EFE4] text-[#123C32] border-t border-black/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Ingestion -> Scenarios) */}
          <SectionThread
            id="ingestion-thread"
            pathD={THREAD_PATHS.ingestion}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 850, y: 620, threshold: 0.65 }}
            progress={sectionProgress.ingestion}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Section Main Content */}
          <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[7.5rem] xl:text-[9rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                INGESTION
              </h2>
              <div className="mt-8">
                <h3 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                  MESSY STATEMENTS IN. CLEAN MODEL OUT.
                </h3>
                <p className="font-sans text-lg sm:text-xl max-w-xl leading-relaxed text-[#536B5F]">
                  Direct parsing of raw PDF, CSV, and transaction SMS dumps. Cleans cryptic narration
                  strings, identifies recurring salary inflows, and preserves user privacy without
                  cloud leakage.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-black/10 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    PARSING SPEED
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    &lt; 240ms
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    FORMAT ACCURACY
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    99.4%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    SUPPORTED TYPES
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    PDF / CSV / SMS
                  </span>
                </div>
              </div>
            </div>

            {/* Improved Ingestion Architecture Card (Item 12, Item 3: non-interactive) */}
            <div className="lg:col-span-5 w-full">
              <div className="p-6 md:p-8 font-mono border border-black/10 bg-[#F8F5EC]/95 text-[#123C32] shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#C49A4A]" />
                    <span className="font-bold tracking-wider uppercase">
                      INARI INGESTION PIPELINE
                    </span>
                  </div>
                  <span className="text-[10px] opacity-70 bg-black/5 px-2 py-0.5 rounded">
                    MULTI-FORMAT
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-[#F8F5EC] border border-black/5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-black/70 mb-1">
                      <span>SOURCE DISCOVERY</span>
                      <span className="text-emerald-600">✓ VERIFIED</span>
                    </div>
                    <p className="text-black/80 font-mono">
                      indiranagar_hdfc_oct.pdf · 524 transactions
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8F5EC] border border-black/5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-black/70 mb-1">
                      <span>INFLOW RECOGNITION</span>
                      <span className="text-[#C49A4A]">87,000.00 INR</span>
                    </div>
                    <p className="text-black/80 font-mono">
                      Techcorp Monthly Salary · Day 01 recurrent
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8F5EC] border border-black/5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-black/70 mb-1">
                      <span>BALANCE INTEGRITY</span>
                      <span className="text-emerald-600">PASSED</span>
                    </div>
                    <p className="text-black/80 font-mono">
                      Running balances reconciled to the exact paisa
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    LOCAL-FIRST ENGINE
                  </span>
                  <span>NO CLOUD LEAKAGE</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2: SCENARIOS SIMULATION / RHYTHMS (Item 8: Header removed, Item 7.1: Link removed)
           ========================================================================= */}
        <section
          ref={scenariosRef}
          id="scenarios"
          className="relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#123C32] text-[#F3EFE4] border-t border-white/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Scenarios -> Buffer) */}
          <SectionThread
            id="scenarios-thread"
            pathD={THREAD_PATHS.scenariosPrimary}
            secondaryPathD={THREAD_PATHS.scenariosSecondary}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 720, y: 500, threshold: 0.5 }}
            progress={sectionProgress.scenarios}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Section Main Content */}
          <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[7.5rem] xl:text-[9rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                RHYTHMS
              </h2>
              <div className="mt-8">
                <h3 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                  ISOLATING THE HARD BASELINE BURN.
                </h3>
                <p className="font-sans text-lg sm:text-xl max-w-xl leading-relaxed text-[#B9C4B3]">
                  Your living profile locks in your non-negotiable fixed costs: Indiranagar rent
                  ₹22,000, utilities ₹1,420, broadband ₹999. Identifies rate creeps and zombie
                  subscriptions before they compound.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-white/10 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    FIXED BURN
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    ₹31,500/MO
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    ACTIVE CADENCES
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    5 RECURRING
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    SURPLUS DELTA
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1 text-emerald-400">
                    +₹25,600
                  </span>
                </div>
              </div>
            </div>

            {/* Improved Baseline Burn Card (Item 12, Item 3) */}
            <div className="lg:col-span-5 w-full">
              <div className="p-6 md:p-8 font-mono border border-white/10 bg-[#173F35] text-[#F3EFE4] shadow-2xl">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#C49A4A]" />
                    <span className="font-bold tracking-wider uppercase">
                      CASHFLOW SEGREGATION
                    </span>
                  </div>
                  <span className="text-[10px] opacity-60">DETERMINISTIC 3.12</span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-white/5 border border-white/5">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#B9C4B3]">FIXED OBLIGATIONS (55%)</span>
                      <span className="font-bold">₹31,500.00</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C49A4A] w-[55%]" />
                    </div>
                    <span className="text-[10px] text-[#F3EFE4]/50 mt-1 block">
                      Rent ₹22,000 · Utilities ₹1,420 · Insurance ₹8,080
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/5">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#B9C4B3]">VARIABLE SPENDING (25%)</span>
                      <span className="font-bold">₹14,200.00</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 w-[25%]" />
                    </div>
                    <span className="text-[10px] text-[#F3EFE4]/50 mt-1 block">
                      Dining, groceries, transit, leisure
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/5">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-[#B9C4B3]">INVESTABLE / GOAL SURPLUS (20%)</span>
                      <span className="font-bold text-emerald-400">₹25,600.00</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-[20%]" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#C49A4A]" />
                    RATE CREEP SENTINEL ACTIVE
                  </span>
                  <span>IMMUTABLE</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3: LIQUID RUNWAY & BUFFER (Item 7: Formatting fixed, Item 8: Header removed)
           ========================================================================= */}
        <section
          ref={bufferRef}
          id="buffer"
          className="relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#F3EFE4] text-[#123C32] border-t border-black/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Buffer -> Waterfall) */}
          <SectionThread
            id="buffer-thread"
            pathD={THREAD_PATHS.buffer}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 320, y: 500, threshold: 0.5 }}
            progress={sectionProgress.buffer}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Section Main Content */}
          <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[7.5rem] xl:text-[9rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                BUFFER
              </h2>
              <div className="mt-8">
                <h3 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                  TRUE RUNWAY IN MONTHS, NOT VAGUE ACCUMULATION.
                </h3>
                <p className="font-sans text-lg sm:text-xl max-w-xl leading-relaxed text-[#536B5F]">
                  Translates liquid reserves into mathematical survival time. 4.0 Months of
                  non-discretionary fixed obligations banked against real life disruptions and
                  income shocks.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-black/10 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    CURRENT RUNWAY
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    4.0 MONTHS
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    LIQUID BUFFER
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    ₹1,26,000
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    SAFE DAILY BURN
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    ₹850 / DAY
                  </span>
                </div>
              </div>
            </div>

            {/* Improved Runway Meter Card (Item 12, Item 3) */}
            <div className="lg:col-span-5 w-full">
              <div className="p-6 md:p-8 font-mono border border-black/10 bg-[#F8F5EC]/95 text-[#123C32] shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#C49A4A]" />
                    <span className="font-bold tracking-wider uppercase">
                      RUNWAY PROTECTION INDEX
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#C49A4A] bg-[#C49A4A]/10 px-2.5 py-0.5 rounded">
                    4.0 MO SAFE
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between text-xs mb-1 font-bold">
                      <span>LIQUID RESERVE PROGRESS</span>
                      <span>₹1,26,000 / ₹1,89,000</span>
                    </div>
                    <div className="w-full h-3 bg-black/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#C49A4A] w-[66.6%]" />
                    </div>
                    <div className="flex justify-between text-[10px] text-black/50 mt-1">
                      <span>Baseline: 0 Mo</span>
                      <span>Target: 6.0 Months</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#F8F5EC] border border-black/5 space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-black/70">Monthly Non-Discretionary:</span>
                      <span className="font-bold">₹31,500</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-black/70">Discretionary Pacing Ceiling:</span>
                      <span className="font-bold">₹850 / day</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-black/70">Zero-Income Survival:</span>
                      <span className="font-bold text-emerald-700">120 Days Guaranteed</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    BUFFER HEALTH: ROBUST
                  </span>
                  <span>NO SPECULATION</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 4: THE WATER SECTION (Cashflow Waterfall / What-If Scenarios - Item 9)
           ========================================================================= */}
        <section
          ref={waterfallRef}
          id="waterfall"
          className="relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#123C32] text-[#F3EFE4] border-t border-white/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Waterfall -> Nudges) */}
          <SectionThread
            id="waterfall-thread"
            pathD={THREAD_PATHS.waterfall}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 1100, y: 500, threshold: 0.5 }}
            progress={sectionProgress.waterfall}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Section Main Content */}
          <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[7.5rem] xl:text-[9rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                WATERFALL
              </h2>
              <div className="mt-8">
                <h3 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                  STRESS-TEST CHOICES BEFORE COMMITTING RUPEES.
                </h3>
                <p className="font-sans text-lg sm:text-xl max-w-xl leading-relaxed text-[#B9C4B3]">
                  What if you cut dining out by 30%? What if rent jumps 10% next lease? What if you
                  take a 4-month sabbatical? Project timelines deterministically across 24
                  configurable months without mutating your active profile.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-white/10 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    PROJECTION SPAN
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    24 MONTHS
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    SIMULATION ENGINE
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    DETERMINISTIC
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    MUTATION RISK
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1 text-emerald-400">
                    0% (READ-ONLY)
                  </span>
                </div>
              </div>
            </div>

            {/* Improved What-If Simulation Waterfall Card (Item 12, Item 3) */}
            <div className="lg:col-span-5 w-full">
              <div className="p-6 md:p-8 font-mono border border-white/10 bg-[#173F35] text-[#F3EFE4] shadow-2xl">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#C49A4A]" />
                    <span className="font-bold tracking-wider uppercase">
                      SCENARIO PROJECTION // SIMULATION
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400">24-MO HORIZON</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5">
                    <span>Baseline Net Inflow:</span>
                    <span className="font-bold">₹87,000 / mo</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5">
                    <span className="text-amber-400">Fixed Cost Shock (+10% Rent):</span>
                    <span className="font-bold text-red-400">-₹2,200 / mo</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5">
                    <span className="text-emerald-400">Lifestyle Cut (-30% Dining):</span>
                    <span className="font-bold text-emerald-400">+₹4,260 / mo</span>
                  </div>
                  <div className="p-3 bg-[#C49A4A]/10 border border-[#C49A4A]/30 text-[#F3EFE4]">
                    <div className="flex justify-between font-bold text-xs mb-1">
                      <span>NET ACCELERATION DELTA:</span>
                      <span className="text-emerald-300">+₹2,060 / mo</span>
                    </div>
                    <p className="text-[11px] text-[#F3EFE4]/80">
                      Kyoto Sabbatical Fund reached 3.5 months ahead of schedule (Sep 2027 instead
                      of Dec 2027).
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    SIMULATION ENGINE: DETERMINISTIC
                  </span>
                  <span>NO GUESSWORK</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 5: THE NUDES SECTION (Nudges & Subscription Sentinel - Item 9)
           ========================================================================= */}
        <section
          ref={nudgesRef}
          id="nudges"
          className="relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#F3EFE4] text-[#123C32] border-t border-black/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Nudges -> Review) */}
          <SectionThread
            id="nudges-thread"
            pathD={THREAD_PATHS.nudges}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 400, y: 500, threshold: 0.5 }}
            progress={sectionProgress.nudges}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Section Main Content */}
          <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[7.5rem] xl:text-[9rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                NUDGES
              </h2>
              <div className="mt-8">
                <h3 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                  GENTLE DRIFT CORRECTION. NEVER FINANCIAL JUDGMENT.
                </h3>
                <p className="font-sans text-lg sm:text-xl max-w-xl leading-relaxed text-[#536B5F]">
                  Proactive velocity alerts when variable spend drifts away from profile targets.
                  INARI nudges you mid-month so you never face month-end deficits, and unmasks zombie
                  subscriptions before renewal.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-black/10 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    DRIFT LATENCY
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    REAL-TIME
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    ZOMBIE SERVICES
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1 text-[#C49A4A]">
                    1 FLAGGED
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    ANNUAL RECOVERY
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    ₹29,988.00
                  </span>
                </div>
              </div>
            </div>

            {/* Improved Subscription Sentinel & Nudge Card (Item 12, Item 3) */}
            <div className="lg:col-span-5 w-full">
              <div className="p-6 md:p-8 font-mono border border-black/10 bg-[#F8F5EC]/95 text-[#123C32] shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-black/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#C49A4A]" />
                    <span className="font-bold tracking-wider uppercase">
                      SUBSCRIPTION SENTINEL
                    </span>
                  </div>
                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">
                    ALERT ACTIVE
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-[#F3E8CC] border border-[#C49A4A]/30">
                    <div className="flex justify-between font-bold text-[#C49A4A] mb-1">
                      <span>[FLAGGED DORMANT] GOLD’S GYM</span>
                      <span>₹2,499 / MO</span>
                    </div>
                    <p className="text-black/80 font-mono text-[11px] leading-relaxed">
                      Zero transit swipes or check-in telemetry detected in the last 62 days.
                      Potential annual recovery: <strong>₹29,988.00</strong>
                    </p>
                  </div>

                  <div className="p-3 bg-[#F8F5EC] border border-black/5">
                    <div className="flex justify-between font-bold text-black/80 mb-1">
                      <span>[MID-MONTH PACING ALERT]</span>
                      <span className="text-amber-600">DAY 14</span>
                    </div>
                    <p className="text-black/70 font-mono text-[11px] leading-relaxed">
                      Variable spend ₹16,400 (18% ahead of baseline). Suggested safe burn for
                      remainder: <strong>₹720 / day</strong>.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-black/10 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    RATIONAL ADVISOR
                  </span>
                  <span>ZERO GUILT</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 6: THE REVIEW SECTION (Monthly Financial Audit - Item 9)
           ========================================================================= */}
        <section
          ref={reviewRef}
          id="review"
          className="relative min-h-[90vh] lg:min-h-[1025px] flex flex-col justify-between py-16 md:py-24 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#123C32] text-[#F3EFE4] border-t border-white/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Review -> Mandate) */}
          <SectionThread
            id="review-thread"
            pathD={THREAD_PATHS.review}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 980, y: 500, threshold: 0.5 }}
            progress={sectionProgress.review}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Section Main Content */}
          <div className="w-full max-w-[1360px] mx-auto my-auto py-10 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[15vw] sm:text-[14vw] md:text-[12vw] lg:text-[7.5rem] xl:text-[9rem] leading-[0.78] tracking-tightest uppercase select-none opacity-95">
                REVIEW
              </h2>
              <div className="mt-8">
                <h3 className="font-archivo font-bold text-2xl sm:text-3xl md:text-4xl uppercase tracking-tight mb-4">
                  THE MONTHLY LIVING FINANCIAL AUDIT.
                </h3>
                <p className="font-sans text-lg sm:text-xl max-w-xl leading-relaxed text-[#B9C4B3]">
                  Comprehensive month-over-month report: savings rate vs 3-month rolling averages,
                  category outliers, subscription audits, and exportable PDF summaries.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-white/10 max-w-lg">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    SAVINGS RATE
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1 text-emerald-400">
                    29.4% (+4.2%)
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    OUTLIERS DETECTED
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    2 NOTABLE
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] sm:text-xs opacity-60 uppercase tracking-wider">
                    AUDIT EXPORT
                  </span>
                  <span className="font-archivo font-bold text-base sm:text-xl uppercase mt-1">
                    HTML &amp; PDF
                  </span>
                </div>
              </div>
            </div>

            {/* Improved Audit Report Card (Item 12, Item 3) */}
            <div className="lg:col-span-5 w-full">
              <div className="p-6 md:p-8 font-mono border border-white/10 bg-[#173F35] text-[#F3EFE4] shadow-2xl">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#C49A4A]" />
                    <span className="font-bold tracking-wider uppercase">
                      MONTHLY LIVING REPORT // OCT 2026
                    </span>
                  </div>
                  <span className="text-[10px] opacity-60">RECONCILED</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5">
                    <span>Confirmed Cashflow Surplus:</span>
                    <span className="font-bold text-emerald-400">+₹25,600.00</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5">
                    <span>Emergency Buffer Allocation:</span>
                    <span className="font-bold">+₹15,000.00</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white/5 border border-white/5">
                    <span>Unusual Non-Recurring Outlier:</span>
                    <span className="text-amber-400 font-bold">₹8,200 (Medical)</span>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/5">
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span>AUDIT INTEGRITY:</span>
                      <span className="text-emerald-400">100% BALANCED</span>
                    </div>
                    <p className="text-[10px] text-[#F3EFE4]/60">
                      Report rendered with zero investment sales pitches or affiliated products.
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] opacity-75">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    EXPORTABLE REPORT
                  </span>
                  <span>VERSIONED LEDGER</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 7: ETHICS & COMPLIANCE MANDATE (Item 9: Matching Daksh's about style)
           ========================================================================= */}
        <section
          ref={mandateRef}
          id="ethics"
          className="relative w-full py-20 md:py-32 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#F3EFE4] text-[#123C32] border-t border-black/10 select-none overflow-hidden"
        >
          {/* Living Thread Layer (Ethics -> FAQ) */}
          <SectionThread
            id="mandate-thread"
            pathD={THREAD_PATHS.mandate}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 1050, y: 500, threshold: 0.5 }}
            progress={sectionProgress.mandate}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Continuous Thread terminating in the concentric fingerprint / cryptographic seal */}
          <div className="w-full max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="font-archivo font-[850] text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.88] tracking-tightest uppercase text-[#123C32] mb-8">
                EVERY NUMBER
                <br />
                CARRIES AN
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C49A4A] to-[#C49A4A]">
                  EXPLAINABLE PROOF.
                </span>
              </h2>
              <p className="font-sans text-lg sm:text-xl text-[#536B5F] max-w-2xl leading-relaxed mb-6">
                INARI was built on a foundational principle: personal finance software should
                explain, never speculate. Every runway figure, goal arrival date, and cash flow
                projection comes from deterministic Python math calculated on your local ledger.
                Zero sponsored recommendations, zero affiliate commissions, and zero AI
                hallucinations on your balance.
              </p>
              <div className="font-mono text-xs sm:text-sm text-[#123C32] pt-4 border-t border-black/10">
                <p className="font-bold tracking-widest uppercase">INARI MONEY ENGINE.</p>
                <p className="text-[#536B5F] mt-0.5">
                  Deterministic. Local-first. Uncompromising.
                </p>
              </div>
            </div>

            {/* Fingerprint / Cryptographic Seal SVG Motif (Daksh style continuous thread loop) */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 300 300"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="150"
                    cy="150"
                    r="135"
                    stroke="#C49A4A"
                    strokeWidth="1.5"
                    strokeDasharray="4 6"
                    opacity="0.3"
                  />
                  <circle
                    cx="150"
                    cy="150"
                    r="115"
                    stroke="#C49A4A"
                    strokeWidth="1.5"
                    opacity="0.5"
                  />
                  <circle
                    cx="150"
                    cy="150"
                    r="95"
                    stroke="#C49A4A"
                    strokeWidth="1.8"
                    strokeDasharray="8 4"
                    opacity="0.7"
                  />
                  <circle
                    cx="150"
                    cy="150"
                    r="75"
                    stroke="#C49A4A"
                    strokeWidth="2.2"
                    opacity="0.85"
                  />
                  <circle cx="150" cy="150" r="50" stroke="#C49A4A" strokeWidth="2.5" />
                  <circle cx="150" cy="150" r="28" fill="#C49A4A" opacity="0.15" />
                  <circle cx="150" cy="150" r="10" fill="#C49A4A" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <Lock className="w-6 h-6 text-[#C49A4A] mb-1" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#123C32]/70 font-bold">
                    ZERO BROKER KICKBACKS
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Mandate Pillars */}
          <div className="w-full max-w-[1360px] mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-20">
            <div className="p-6 sm:p-8 bg-[#F8F5EC] border border-black/10 shadow-sm">
              <div className="w-10 h-10 rounded-md bg-[#C49A4A]/10 flex items-center justify-center text-[#C49A4A] mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-archivo font-bold text-base sm:text-lg uppercase tracking-tight mb-2">
                ZERO SECURITIES PROMOTIONS
              </h3>
              <p className="font-sans text-sm text-[#536B5F] leading-relaxed">
                We will never sell individual stocks, promote mutual funds, pitch credit cards, or
                push cryptocurrency. We earn zero kickbacks and carry zero broker relationships.
              </p>
            </div>

            <div className="p-6 sm:p-8 bg-[#F8F5EC] border border-black/10 shadow-sm">
              <div className="w-10 h-10 rounded-md bg-[#C49A4A]/10 flex items-center justify-center text-[#C49A4A] mb-4">
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="font-archivo font-bold text-base sm:text-lg uppercase tracking-tight mb-2">
                DETERMINISTIC PYTHON MATH
              </h3>
              <p className="font-sans text-sm text-[#536B5F] leading-relaxed">
                Every calculation, goal arrival date, and liquid runway estimation is computed by
                deterministic mathematical code. No language model guesses your account balance.
              </p>
            </div>

            <div className="p-6 sm:p-8 bg-[#F8F5EC] border border-black/10 shadow-sm">
              <div className="w-10 h-10 rounded-md bg-[#C49A4A]/10 flex items-center justify-center text-[#C49A4A] mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-archivo font-bold text-base sm:text-lg uppercase tracking-tight mb-2">
                LOCAL &amp; SOVEREIGN DATA
              </h3>
              <p className="font-sans text-sm text-[#536B5F] leading-relaxed">
                Your bank statements are parsed locally within your own session. Every modification
                is recorded as an immutable version that you can audit, verify, or rollback at any
                time.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 8: FREQUENTLY ANSWERED INQUIRIES (FAQ)
           ========================================================================= */}
        <section
          ref={faqRef}
          id="faq"
          className="relative w-full py-20 md:py-28 px-4 sm:px-6 md:px-10 lg:px-12 bg-[#123C32] text-[#F3EFE4] border-t border-white/10"
        >
          {/* Living Thread Layer (FAQ -> Footer Terminal) */}
          <SectionThread
            id="faq-thread"
            pathD={THREAD_PATHS.faq}
            viewBox="0 0 1440 1000"
            checkpoint={{ x: 720, y: 900, threshold: 0.95 }}
            isTerminal={true}
            progress={sectionProgress.faq}
            prefersReducedMotion={prefersReducedMotion}
          />
          <div className="w-full max-w-[1360px] mx-auto">
            <div className="max-w-4xl mb-12 md:mb-16">
              <h2 className="font-archivo font-[800] text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-[#F3EFE4]">
                QUESTIONS
                <br />
                ABOUT THE MODEL.
              </h2>
              <p className="mt-4 font-sans text-base sm:text-lg text-[#B9C4B3] max-w-2xl leading-relaxed">
                Clear answers about how INARI processes bank statements, calculates deterministic
                runways, and safeguards your financial autonomy.
              </p>
            </div>

            <div className="max-w-4xl border-t border-white/10">
              {faqData.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={item.question} className="border-b border-white/10">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full py-6 flex items-center justify-between text-left group focus:outline-none"
                    >
                      <span className="font-archivo font-bold text-base sm:text-lg uppercase tracking-tight text-[#F3EFE4] group-hover:text-[#C49A4A] transition-colors pr-4">
                        {item.question}
                      </span>
                      <span className="text-[#C49A4A] shrink-0">
                        {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="pb-6 font-sans text-sm sm:text-base text-[#B9C4B3] leading-relaxed">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          FOOTER (Item 1: Inari Logo included, Item 6: Links to all pages & dashboard)
         ========================================================================= */}
      <footer className="w-full bg-[#123C32] text-[#B9C4B3] border-t border-white/10 py-12 px-6 sm:px-10 lg:px-14 select-none">
        <div className="w-full max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-8 border-b border-white/10">
          <div className="flex items-center gap-3">
            <BrandEmblem size={36} />
            <span className="font-archivo font-extrabold text-2xl uppercase text-[#F3EFE4] tracking-tight">
              INARI<span className="text-[#C49A4A]">●</span>
            </span>
          </div>

          <nav
            className="flex flex-wrap items-center gap-6 font-mono text-xs uppercase tracking-wider text-[#F3EFE4]/80"
            aria-label="Footer navigation"
          >
            <a href="/dashboard" className="text-[#C49A4A] font-bold hover:text-[#F3EFE4] transition-colors">
              Dashboard ⚡
            </a>
            <a href="/import" className="hover:text-[#F3EFE4] transition-colors">
              Import
            </a>
            <a href="/spending" className="hover:text-[#F3EFE4] transition-colors">
              Spending
            </a>
            <a href="/goals" className="hover:text-[#F3EFE4] transition-colors">
              Goals
            </a>
            <a href="/recommendations" className="hover:text-[#F3EFE4] transition-colors">
              Scenarios
            </a>
            <a href="/avatar" className="hover:text-[#F3EFE4] transition-colors">
              Advisor
            </a>
            <a href="/support" className="hover:text-[#F3EFE4] transition-colors">
              Support
            </a>
            <a href="/inari" className="hover:text-[#F3EFE4] transition-colors">
              Studio
            </a>
          </nav>
        </div>

        <div className="w-full max-w-[1440px] mx-auto pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px] opacity-60">
          <p>
            Educational personal finance scenario modeling. Pure deterministic math. Zero
            solicitation of securities or investment products.
          </p>
          <p>© {new Date().getFullYear()} INARI · One ledger. A living money model.</p>
        </div>
      </footer>
    </div>
  );
}
