import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export const IngestionWorld: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [viewportH, setViewportH] = useState(900);
  const [secTop, setSecTop] = useState(0);
  const [secHeight, setSecHeight] = useState(1100);
  const [jurisdiction, setJurisdiction] = useState<'INDIA' | 'US'>('INDIA');

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

  // Relative scroll progression through IngestionWorld [0, 1]
  const scrollCursor = scrollY + viewportH * 0.45;
  const progress = Math.min(
    1,
    Math.max(0, (scrollCursor - secTop) / Math.max(1, secHeight))
  );

  // Kinetic title drift
  const relSecScroll = Math.max(0, scrollY - secTop + 300);
  const titleDrift = -relSecScroll * 0.08;

  // Thread path length ~ 3600
  const THREAD_LEN = 3600;
  const threadDashoffset = THREAD_LEN * (1 - progress);

  // Milestone triggers
  const flatActive = progress >= 0.12;
  const leaseActive = progress >= 0.25;
  const inspActive = progress >= 0.40;
  const titleActive = progress >= 0.48;
  const repairActive = progress >= 0.68;
  const ledgerActive = progress >= 0.82;

  return (
    <article
      ref={sectionRef}
      id="ingestion"
      className="project-world world-eigna world-light relative w-full bg-[#f1eee6] text-[#050505] min-h-[960px] lg:min-h-[1120px] overflow-hidden select-none transition-colors duration-500"
      aria-labelledby="ingestion-title"
    >
      {/* ======================================================== */}
      {/* 1. TOP KICKER & DESCRIPTIVE STATEMENT                    */}
      {/* ======================================================== */}
      <p className="world-kicker absolute top-[5%] sm:top-[6.4%] left-6 sm:left-10 lg:left-14 font-mono text-xs sm:text-sm tracking-[0.07em] uppercase text-[#050505] z-30 font-bold bg-[#f1eee6] px-1">
        01 / STATEMENT INGESTION
      </p>

      <p className="world-description absolute top-[5%] sm:top-[6.4%] right-6 sm:right-10 lg:right-14 max-w-[90%] sm:max-w-[450px] md:max-w-[550px] text-right font-mono text-xs sm:text-sm text-[#050505] leading-relaxed z-30 bg-[#f1eee6] px-1">
        <span className="hidden sm:inline">
          Manage properties, tenants, rent,<br />
          maintenance and finances from one place.
        </span>
        <span className="sm:hidden">
          Direct parsing of messy statements into a living model.
        </span>
      </p>

      {/* ======================================================== */}
      {/* 2. DYNAMIC VERMILION THREAD LAYER (SVG)                 */}
      {/* ======================================================== */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[15]"
        viewBox="0 0 1440 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Subtle guide track */}
        <path
          d="M 720 0 C 720 50, 420 80, 338 115 L 338 250 Q 338 275, 363 275 L 676 275 C 700 275, 730 310, 770 320 C 880 340, 1000 360, 1070 340 C 1120 330, 1200 335, 1260 330 C 1340 330, 1370 420, 1340 500 C 1300 580, 1150 560, 950 540 C 750 520, 450 500, 280 540 C 180 570, 90 620, 90 710 C 90 800, 170 820, 320 800 C 450 780, 600 780, 750 790 C 900 800, 1050 810, 1200 830 C 1280 840, 1340 880, 1320 960 L 1320 1000"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="1"
          strokeOpacity="0.12"
          vectorEffect="non-scaling-stroke"
        />

        {/* Animated vermilion active thread */}
        <path
          d="M 720 0 C 720 50, 420 80, 338 115 L 338 250 Q 338 275, 363 275 L 676 275 C 700 275, 730 310, 770 320 C 880 340, 1000 360, 1070 340 C 1120 330, 1200 335, 1260 330 C 1340 330, 1370 420, 1340 500 C 1300 580, 1150 560, 950 540 C 750 520, 450 500, 280 540 C 180 570, 90 620, 90 710 C 90 800, 170 820, 320 800 C 450 780, 600 780, 750 790 C 900 800, 1050 810, 1200 830 C 1280 840, 1340 880, 1320 960 L 1320 1000"
          fill="none"
          stroke="#ff3b12"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={THREAD_LEN}
          strokeDashoffset={threadDashoffset}
          className="transition-all duration-75 ease-out"
        />
      </svg>

      {/* ======================================================== */}
      {/* 3. WORLD COMPOSITION (SCHEMATIC OBJECTS)                 */}
      {/* ======================================================== */}
      <div className="world-composition absolute inset-0 w-full h-full">
        {/* Object 1: Flat Blueprint (Unit 03 2 Bed / 1 Bath) */}
        <div
          data-eigna="property"
          className={`world-object eigna-flat absolute left-[6%] top-[11.5%] w-[42%] z-[8] transition-opacity duration-300 ${
            flatActive ? 'opacity-100' : 'opacity-85'
          }`}
        >
          <svg viewBox="0 0 620 345" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unit 03: occupied two-bedroom flat with living room, kitchen and bathroom"><defs><mask id="eigna-flat-wall-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="620" height="345"><rect width="620" height="345" fill="white"></rect><rect x="234" y="6" width="48" height="14" fill="black"></rect><rect className="eigna-flat-side-opening" x="598" y="153" width="14" height="20" fill="black"></rect></mask></defs><g mask="url(#eigna-flat-wall-mask)" stroke="currentColor" strokeWidth=".9" strokeLinejoin="round"><path d="M30 8H610V329H291v-10h309V18H40v210H16v91h226v10H6V218H30Z" fill="var(--world-bg)"></path><path d="M35 13h570v311H291M242 324H11V223h24V13" opacity=".45"></path><path d="M210 18h7v111h-7zM210 174h7v41h-7zM210 260h7v59h-7zM416 18h7v111h-7zM416 174h7v111h-7zM416 312h7v7h-7zM40 174h170v6H40zM423 174h177v6H423zM423 248h37v6h-37zM500 248h100v6H500zM510 180v68" fill="var(--world-bg)"></path><g fill="var(--world-bg)"><path d="M67 8h72v10H67zM268 8h85v10h-85zM476 8h73v10h-73zM65 319h85v10H65zM331 319h59v10h-59zM545 319h36v10h-36z"></path></g><path d="M67 12h72m-72 3h72M268 12h85m-85 3h85M476 12h73m-73 3h73M65 323h85m-85 3h85M331 323h59m-59 3h59M545 323h36m-36 3h36" opacity=".6"></path></g><g stroke="currentColor" strokeWidth=".9"><path d="M234 8v10M282 8v10"></path><path className="eigna-flat-side-opening" d="M600 153h10M600 173h10"></path></g><g className="eigna-furnishings" stroke="currentColor" strokeWidth=".75" opacity=".6"><g><rect x="66" y="49" width="91" height="108" rx="2"></rect><path d="M63 49v-5h97v5M70 53h38v23h-38zM115 53h38v23h-38zM66 82h91m-91 7h91M71 90v61h81V90M43 49h17v22h-17zM163 49h17v22h-17z"></path><circle cx="51.5" cy="60" r="5"></circle><circle cx="171.5" cy="60" r="5"></circle></g><g><rect x="474" y="49" width="91" height="108" rx="2"></rect><path d="M471 49v-5h97v5M478 53h38v23h-38zM523 53h38v23h-38zM474 82h91m-91 7h91M479 90v61h81V90M451 49h17v22h-17zM571 49h17v22h-17z"></path><circle cx="459.5" cy="60" r="5"></circle><circle cx="579.5" cy="60" r="5"></circle></g><rect x="267" y="49" width="116" height="42" rx="3"></rect><path d="M272 53h106v9H272zM272 65h32v21h-32zM307 65h33v21h-33zM343 65h35v21h-35zM272 91v4m106-4v4M236 48h14v103h-14zM240 53h6v93h-6z"></path><rect x="293" y="113" width="67" height="37" rx="17"></rect><path d="m318 119 16 3-3 19-16-3zM375 121h20v20h-20z"></path><g transform="translate(356 172) rotate(25)"><rect width="35" height="38" rx="4"></rect><path d="M4 5h27v8H4zM6 16h23v16H6zM0 13h5v20H0m35-20h-5v20h5"></path></g><path d="M29 238h162v68H29zM29 271h162M36 244h45v21H36zM41 247h35v15H41zM61 241v-9h8M89 242h46v26H89zM29 277h162m-113 0v29m55-29v29M156 244h27v21h-27z"></path><g><circle cx="100" cy="250" r="4"></circle><circle cx="100" cy="261" r="3"></circle></g><g><circle cx="124" cy="250" r="4"></circle><circle cx="124" cy="261" r="3"></circle></g><path d="M433 190h59v15h-59zM439 193h22v8h-22zM466 193h21v8h-21zM526 190h61v45h-61zM531 195h51v35h-51zM530 230l53-35M448 267h20v13h-20zM449 282c-5 22 25 22 18 0zM508 264h79v43h-79zM514 269h67v32h-67q-9-16 0-32"></path></g><g fill="currentColor" fontSize="10"><text x="5" y="340">UNIT 03</text><text className="eigna-occupied" x="84" y="340">OCCUPIED</text><text x="610" y="340" textAnchor="end">2 BED / 1 BATH</text></g></svg>
        </div>

        {/* Object 2: Lease Agreement Card with VIEW Badge */}
        <div
          data-eigna="lease"
          className="world-object eigna-lease absolute left-[52.5%] top-[18%] w-[15.5%] -rotate-[9deg] z-[21]"
        >
          <div className="relative w-full h-full">
            <svg viewBox="0 0 205 218" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unit 03 lease signed, monthly rent ₹32,000"><path d="M1 1h203v216H1Z" fill="var(--world-bg)" stroke="currentColor" strokeWidth=".85"></path><path d="M22 60h161M22 143h161M22 198h108" stroke="currentColor" strokeWidth=".6" opacity=".4"></path><g fill="currentColor"><text x="22" y="29" fontSize="12">LEASE AGREEMENT</text><g fontSize="8" opacity=".6"><text x="22" y="46">RESIDENTIAL</text><text x="183" y="46" textAnchor="end">UNIT 03</text><text x="22" y="80">MONTHLY RENT</text></g><text x="22" y="106" fontSize="20">₹32,000</text><text x="183" y="106" textAnchor="end" fontSize="9" opacity=".6">/ MO</text><text x="22" y="127" fontSize="9">TENANT / 01</text><text className="eigna-lease-check" x="183" y="127" textAnchor="end" fontSize="8">ACTIVE</text><text x="22" y="160" fontSize="8" opacity=".6">TENANT SIGNATURE</text></g><path className="eigna-signature" pathLength="1" transform="translate(8 77) scale(.65)" d="M23 178c58-68 46-32 4 2c18-8 24-44 23-16s17-23 13-5s20-16 17 0s15-14 14 0s15-9 24-3l-91 29" stroke="currentColor" strokeWidth="1.1"></path><g className="eigna-lease-check"><circle cx="169" cy="183" r="11" stroke="currentColor" strokeWidth=".8"></circle><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" x="161" y="175" width="16" height="16"><path d="M5 12l5 5L20 6"></path></svg></g></svg>

            {/* Circular Vermilion VIEW Badge */}
            <div
              className={`absolute -bottom-4 -right-4 sm:-bottom-5 sm:-right-5 w-11 h-11 sm:w-14 sm:h-14 bg-[#ff3b12] rounded-full flex items-center justify-center text-white font-mono text-[10px] sm:text-xs font-bold uppercase shadow-[0_4px_16px_rgba(255,59,18,0.4)] z-30 transition-transform duration-300 ${
                leaseActive ? 'scale-100' : 'scale-90'
              }`}
            >
              VIEW
            </div>
          </div>
        </div>

        {/* Object 3: Move In / Move Out Inspection with Window Crack */}
        <div
          data-eigna="inspection"
          className="world-object eigna-inspection absolute left-[71%] top-[19%] w-[25.5%] z-[21]"
        >
          <svg viewBox="0 0 370 225" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AI inspection compares move-in and move-out records and detects wall damage with 94 percent confidence"><g stroke="currentColor" strokeWidth=".85"><path d="M9 19 157 63V195L9 151Z M40 49l24 7v86l-24-7Z" fill="var(--world-bg)" fillRule="evenodd" stroke="none"></path><path d="M9 19 157 63M9 25l148 44M9 30l148 44M17 15v141m8-139v141M10 145l146 44M10 151l146 44M133 51v132" opacity=".45"></path><path d="m31 37 42 13v106l-42-13zM35 43l34 10v96l-34-10zM40 49l24 7v86l-24-7zM48 52v85M31 144l-5 6 48 14 5-6M29 32v117"></path><path d="m85 67 64 19M84 99l65 19M84 131l65 19M101 73v25m17 6v27m-17 6v25" opacity=".13"></path></g><g transform="translate(200 0)"><g stroke="currentColor" strokeWidth=".85"><path d="M9 19 157 63V195L9 151Z M40 49l24 7v86l-24-7Z" fill="var(--world-bg)" fillRule="evenodd" stroke="none"></path><path d="M9 19 157 63M9 25l148 44M9 30l148 44M17 15v141m8-139v141M10 145l146 44M10 151l146 44M133 51v132" opacity=".45"></path><path d="m31 37 42 13v106l-42-13zM35 43l34 10v96l-34-10zM40 49l24 7v86l-24-7zM48 52v85M31 144l-5 6 48 14 5-6M29 32v117"></path><path d="m85 67 64 19M84 99l65 19M84 131l65 19M101 73v25m17 6v27m-17 6v25" opacity=".13"></path><path className="eigna-crack" d="m119 70-6 19 5 11-13 16 3 13-13 22m10-35-12-8-3-13m18 34 13 8 4 15"></path><path className="eigna-detection" d="M92 75h-8v8m47-8h8v8m0 62v8h-8m-39 0h-8v-8" stroke="var(--signal)" strokeWidth="1.3"></path></g></g><g fill="currentColor" fontSize="11"><text x="22" y="218">MOVE IN</text><text x="222" y="218">MOVE OUT</text></g></svg>
        </div>

        {/* Object 4: Giant Display Mammoth Wordmark (INGESTION) */}
        <h3
          id="ingestion-title"
          className="world-title absolute top-[43%] left-[3%] right-[3%] font-archivo font-[850] text-[24vw] leading-[0.82] tracking-[-0.035em] text-center uppercase text-[#050505] z-[20] pointer-events-none select-none"
        >
          <span
            className="block will-change-transform transition-all duration-300"
            style={{
              transform: `translate3d(${titleDrift}px, 0, 0)`,
              filter: titleActive ? 'blur(0px)' : 'blur(4px)',
              opacity: titleActive ? 1 : 0.85,
            }}
          >
            INGESTION
          </span>
        </h3>

        {/* Object 5: Wrench Repair Tool (Bottom Left) */}
        <div
          data-eigna="repair"
          className="world-object eigna-repair absolute left-[5%] top-[69%] w-[28%] z-[21]"
        >
          <div className="relative w-full h-full">
            <svg viewBox="0 0 400 275" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wall repair completed; ₹4,800 becomes an expense in the property ledger"><g className="eigna-wrench" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" transform="translate(-9 5) rotate(-12 180 100)"><path d="M40 169 204 49C201 22 224 4 253 9L235 39 248 62 274 62 292 32C308 59 297 87 270 95C259 98 249 97 239 93L62 215C31 231 10 187 40 169Z" fill="var(--world-bg)"></path><circle cx="49" cy="193" r="10"></circle><path d="M69 185 215 76M72 193 219 84M227 32l-6 9 20 34h39l6-10" opacity=".45"></path></g><g className="eigna-repair-desktop"><g fill="currentColor" fontSize="11"><text x="186" y="198">WALL REPAIR</text><text x="186" y="233">₹4,800</text><text className="eigna-assigned" x="186" y="252">ASSIGNED</text><text className="eigna-completed" x="186" y="252">COMPLETED</text></g><path d="M186 211h143" stroke="currentColor" strokeWidth=".6" opacity=".4"></path></g></svg>
          </div>
        </div>

        {/* Object 6: Ring-bound Ledger Book (Bottom Right) */}
        <div
          data-eigna="book"
          className="world-object eigna-book absolute left-[45%] top-[65%] w-[43%] rotate-[2deg] z-[21]"
        >
          <div className="relative w-full h-full">
            <svg viewBox="0 0 720 270" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Property 03 ledger. Rent ₹32,000, repair ₹4,800, other expenses ₹1,250, net ₹25,950. The same repair record carries into ITR / SCHEDULE HP."><g stroke="currentColor" strokeWidth=".85" fill="var(--world-bg)"><path d="M7 15 342 6Q358 7 365 14Q374 8 393 10L712 13 719 265 377 265Q362 260 349 264L1 263Z"></path><path d="m12 9 332-5q13 0 21 10q13-8 28-8l315 2 6 251-337 1q-15-6-28 0L6 257Z"></path><path d="M18 1 342 1Q357 2 365 12Q378 3 393 3L703 3 707 252 382 253Q371 251 365 257Q356 251 343 252L12 250Z"></path><path d="M365 12v245m-5-239v231m11-235v234" opacity=".45"></path></g><g stroke="currentColor" strokeWidth=".6" opacity=".5"><path d="M43 58h283M43 189h283M402 58h270M402 189h270"></path></g><g fill="currentColor" fontSize="12"><text x="43" y="37">APR / UNIT 03</text><text x="402" y="37">TAX / FY26</text></g><g data-eigna="ledger" data-thread-scrub="true" fill="currentColor" fontSize="13" ><g className="eigna-rent-row"><text x="43" y="98">RENT</text><text x="326" y="98" textAnchor="end">+  ₹32,000</text></g><g className="eigna-expense-row"><text x="43" y="133">REPAIR</text><text x="326" y="133" textAnchor="end">−  ₹4,800</text></g><g className="eigna-other-row"><text x="43" y="168">OTHER</text><text x="326" y="168" textAnchor="end">−  ₹1,250</text></g><g className="eigna-net-row" fontSize="18"><text x="43" y="222">NET</text><text x="326" y="222" textAnchor="end">₹25,950</text></g></g><g data-eigna="tax" data-thread-scrub="true" fill="currentColor" fontSize="13" ><g className="eigna-tax-record"><text x="402" y="98">WALL REPAIR</text><text x="672" y="98" textAnchor="end">₹4,800</text><text x="402" y="133">RECORD</text><text x="672" y="133" textAnchor="end">LINKED</text><text x="402" y="168">FORM</text><text className="eigna-tax-form" x="672" y="168" textAnchor="end" fontSize="11">ITR / SCHEDULE HP</text><text className="eigna-tax-status" x="402" y="222" fontSize="18">RECORDED</text><circle cx="657" cy="216" r="13" fill="none" stroke="currentColor" strokeWidth=".8"></circle><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" x="648" y="207" width="18" height="18"><path d="M5 12l5 5L20 6"></path></svg></g></g><g stroke="currentColor" strokeWidth=".8" fill="var(--world-bg)"><ellipse cx="356" cy="39" rx="3" ry="5"></ellipse><ellipse cx="375" cy="39" rx="3" ry="5"></ellipse><path d="M356 39c-7-10 25-10 19 0m-19 0c-4-5 22-5 19 0"></path></g><g stroke="currentColor" strokeWidth=".8" fill="var(--world-bg)"><ellipse cx="356" cy="123" rx="3" ry="5"></ellipse><ellipse cx="375" cy="123" rx="3" ry="5"></ellipse><path d="M356 123c-7-10 25-10 19 0m-19 0c-4-5 22-5 19 0"></path></g><g stroke="currentColor" strokeWidth=".8" fill="var(--world-bg)"><ellipse cx="356" cy="210" rx="3" ry="5"></ellipse><ellipse cx="375" cy="210" rx="3" ry="5"></ellipse><path d="M356 210c-7-10 25-10 19 0m-19 0c-4-5 22-5 19 0"></path></g></svg>

            {/* Interactive Jurisdiction Switch (INDIA / US) */}
            <div className="eigna-geography absolute top-[12%] right-[6%] flex items-center gap-2 font-mono text-xs sm:text-sm text-[#050505] z-30">
              <button
                type="button"
                onClick={() => setJurisdiction('INDIA')}
                className={`font-mono font-bold transition-opacity ${
                  jurisdiction === 'INDIA' ? 'opacity-100 underline underline-offset-4' : 'opacity-40 hover:opacity-80'
                }`}
              >
                INDIA
              </button>
              <span className="opacity-40">/</span>
              <button
                type="button"
                onClick={() => setJurisdiction('US')}
                className={`font-mono font-bold transition-opacity ${
                  jurisdiction === 'US' ? 'opacity-100 underline underline-offset-4' : 'opacity-40 hover:opacity-80'
                }`}
              >
                US
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. BOTTOM WORLD LINK (EXPLORE INGESTION)                 */}
      {/* ======================================================== */}
      <a
        href="#simulate"
        className="world-link absolute bottom-8 sm:bottom-10 right-6 sm:right-10 lg:right-14 font-mono text-xs sm:text-sm tracking-[0.07em] uppercase text-[#050505] pb-2 border-b border-[#050505] inline-flex items-center gap-4 hover:text-[#ff3b12] hover:border-[#ff3b12] transition-colors z-30"
      >
        EXPLORE INGESTION
        <span className="interaction-arrow">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </a>
    </article>
  );
};
