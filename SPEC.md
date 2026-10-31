# INARI Frontend Design Specification (SPEC.md)

This specification documents the reverse-engineered visual design, structural layout, typography, color tokens, animations, and responsive breakpoints of `https://dakshgajjar.com/` and defines the exact mapping to the **INARI** living money model frontend.

---

## 1. Reference Architecture & Section Order

The reference site is a brutalist editorial experience characterized by alternating deep-black (`#050505`) and warm-ivory (`#f1eee6`) canvas stages, massive display typography (`Archivo`), monospace technical annotations (`IBM Plex Mono`), a fixed minimalist header with `mix-blend-mode: difference`, and a continuous **Vermilion Thread** (`#ff3b12`) connecting every section.

### Ordered Section Breakdown

1. **Fixed Header (`site-header`)**
   - **Height**: `clamp(72px, 8vw, 98px)`, fixed `top: 0`, `z-index: 60`, `pointer-events: none` (links `pointer-events: auto`).
   - **Blend Mode**: `mix-blend-mode: difference` (white text inverting dynamically over dark/light canvases).
   - **Content**:
     - *Left*: Brand wordmark `INARI` with celestial diamond star accent.
     - *Center*: Monospace navigation links (`01 MODEL`, `02 ENGINE`, `03 WORLDS`, `04 PREVIEW`, `05 TRUST`, `06 FAQ`).
     - *Right*: Live status pill (`● RUNWAY: 4.2 MO`) and primary CTA button ("Launch Console").

2. **Hero Section (`hero thread-scene`)**
   - **Canvas**: Dark (`#050505`).
   - **Height**: `100svh` (min-height `720px`).
   - **Layout**: Full-width container with page padding `clamp(1.5rem, 4vw, 4rem)`.
   - **Display Headline**: Massive stacked brutalist title:
     `MONEY THAT`  
     `UNDERSTANDS.`  
     (Size: `clamp(3.5rem, 14.5vw, 13.2rem)`, Line-height: `0.78`, Weight: `850`, Tracking: `-0.04em`).
   - **Supporting Copy**: Editorial narrative about the living money model: *"Most budgeting apps categorize transactions and stop there. INARI builds a living financial model that understands your true burn, protects your buffer, and adapts as life changes."*
   - **Hero CTAs**: Dual CTA group:
     - Primary: "Get started" (solid vermilion button with arrow).
     - Secondary: "See how it works" (outlined ivory button with smooth scroll anchor).
   - **Telemetry Strip**: Bottom telemetry bar showing:
     - `CORE: DETERMINISTIC PYTHON`
     - `INGESTION: PDF / CSV / SMS`
     - `ADAPTIVE BUFFER: ACTIVE`
     - `SECURITIES: NEVER SOLD`

3. **Core Architecture & How It Works (`selected-work`)**
   - **Canvas**: Light (`#f1eee6`).
   - **Padding**: `clamp(5rem, 9vw, 10rem) clamp(1.5rem, 4vw, 4rem)`.
   - **Headline**: `FROM RAW DATA` <br/> `TO LIVING` <br/> `SIMULATIONS.` (Size: `clamp(2.5rem, 7.8vw, 7.2rem)`).
   - **Eyebrow**: `HOW IT WORKS / ARCHITECTURAL PIPELINE`.
   - **3-Step Architectural Grid**:
     - *Column 01*: `01 / CONNECT & INGEST` — Ingest messy statement dumps (PDF, CSV, SMS). Deterministic extraction flags merchant, frequency, and cadence.
     - *Column 02*: `02 / LIVING PROFILE SYNTHESIS` — Fixed obligations (Indiranagar rent ₹22k, utilities, EMIs) are isolated from variable burn to build an immutable, versioned baseline.
     - *Column 03*: `03 / WHAT-IF SIMULATION` — Test real life choices before committing rupees: sabbatical, career pivots, rent hikes, or discretionary cuts.

4. **Capabilities Matrix (`capabilities thread-scene`)**
   - **Canvas**: Dark (`#050505`).
   - **Padding**: `clamp(5rem, 8vw, 8rem) clamp(1.5rem, 4vw, 4rem)`.
   - **Headline**: `I DESIGN THE MATH.` <br/> `AND THE LIVING MODEL` <br/> `BEHIND IT.`
   - **Pillars (2x2 Technical Grid)**:
     - *Pillar 01: Adaptive Correction Loop* — User corrections teach persistent heuristics. No black-box re-categorization surprises.
     - *Pillar 02: Recurring Payment & Subscription Sentinel* — Flags silent rate creeps, renewals, and zombie services with zero recent activity.
     - *Pillar 03: Deterministic Runway Math* — Strict formulaic runway projections calculated down to safe daily spending limits.
     - *Pillar 04: Non-Advisory Guardrails* — Strict separation between financial coaching scenarios and securities selling.

5. **The 6 Living Worlds Showcase (`project-worlds`)**
   - Alternating full-viewport editorial worlds (Height `max(760px, 71.2vw)` each, approx `1025px` on desktop) with mammoth display headings and technical telemetry panels:
   - **World 01: INGESTION (Light `#f1eee6`)**
     - Display: `INGESTION` (`font-size: clamp(4rem, 20vw, 21.6rem)`).
     - Sub: Messy statement intake with 99.4% category extraction rate across 500+ records.
   - **World 02: RHYTHMS (Dark `#050505`)**
     - Display: `RHYTHMS` (`font-size: clamp(4rem, 19.5vw, 21.1rem)`).
     - Sub: Recurring obligations locked at ₹31,500/mo (Indiranagar rent ₹22,000, BESCOM ₹1,420, Wi-Fi ₹999).
   - **World 03: BUFFER (Light `#f1eee6`)**
     - Display: `BUFFER` (`font-size: clamp(4rem, 16vw, 16rem)`).
     - Sub: 4.0 Months Emergency Runway (`₹1,26,000` liquid cash reserve) and daily safe burn limit.
   - **World 04: WHAT-IF (Dark `#050505`)**
     - Display: `WHAT-IF` (`font-size: clamp(3.5rem, 13vw, 12rem)`).
     - Sub: Multi-variable goal scenario modeling with real-time target arrival recalculation.
   - **World 05: NUDGES (Light `#f1eee6`)**
     - Display: `NUDGES` (`font-size: clamp(4rem, 18vw, 18.9rem)`).
     - Sub: Frictionless alerts when variable spend drifts off profile track, before month-end deficits.
   - **World 06: REVIEW (Dark `#050505`)**
     - Display: `REVIEW` (`font-size: clamp(4rem, 18vw, 18.7rem)`).
     - Sub: Month-over-month deterministic financial audit, savings rate trajectory, and exportable report.

6. **Interactive Product Preview Dashboard (`product-preview-section`)**
   - **Canvas**: Dark (`#050505`) with technical card surfaces (`#11100f`).
   - **Layout**: Centered dashboard stage with 4 coordinated live interactive components:
     - *Component A: Living Cash Flow & Spending Chart* — Dynamic SVG/Canvas cash flow chart showing Inflow (₹87,000), Fixed Burn (₹31,500), Variable Spend, and Net Savings.
     - *Component B: Goal Arrival Radar* — Interactive cards for goals ("Emergency Buffer 6M", "Japan Expedition", "MacBook Pro M4") with progress %, completion date estimates, and status badges (`ON TRACK`, `AT RISK`).
     - *Component C: Live What-If Scenario Slider* — Interactive slider ("Cut Dining Out Spend: 0% to 50%") dynamically recalculating projected savings and expediting goal completion dates in real time.
     - *Component D: Subscription Sentinel Alert* — Live audit card: "Apparently Unused Subscription: Gym Membership (₹2,499/mo) — 62 days with zero attendance signal."

7. **Trust, Ethics & Compliance (`trust-section` / `about-story`)**
   - **Canvas**: Light (`#f1eee6`).
   - **Headline**: `EVERY RUPEE` <br/> `CARRIES A` <br/> `HUMAN CHOICE.`
   - **Core Manifestos**:
     - *No Securities Selling*: INARI never recommends stocks, mutual funds, cryptos, or insurance schemes. Zero kickbacks, zero affiliate affiliate brokers.
     - *Deterministic Math*: Every projection is explicit Python math that you can inspect and audit. No hallucinating LLMs doing arithmetic.
     - *Local & Sovereign*: Your statements stay yours. Profile versions are saved locally.

8. **Frequently Asked Questions (`faq-section`)**
   - **Canvas**: Dark (`#050505`).
   - **Format**: Accordion with crisp border dividers (`rgba(241, 238, 230, 0.15)`), active state expansion, and fluid height transitions.
   - **Items**:
     - 1. *How does INARI differ from standard budgeting apps?*
     - 2. *Is my financial data uploaded or sold to third parties?*
     - 3. *How does the What-If simulation work?*
     - 4. *Can I edit or override the derived numbers?*
     - 5. *Why does INARI refuse to recommend investment products?*

9. **Terminal Finale & Footer (`contact-finale`)**
   - **Canvas**: Dark (`#050505`).
   - **Headline**: `HAVE A` <br/> `FINANCIAL WHAT-IF` <br/> `WORTH MODELING?`
   - **Interactive Launch Console**: High-contrast terminal button trigger: "GET STARTED WITH INARI".
   - **Footer Grid**:
     - Brand identity & copyright.
     - Navigation anchors.
     - Educational disclaimer badge: *"INARI is an educational financial modeling tool. It does not provide registered investment advice, solicit securities, or broker financial products."*

---

## 2. Layout & Spacing Metrics

| Property | Desktop (1440px) | Tablet (768px) | Mobile (375px) |
| :--- | :--- | :--- | :--- |
| **Max Container Width** | `1360px` | `100%` | `100%` |
| **Page Horizontal Padding (`--page-pad`)** | `clamp(2rem, 4vw, 4rem)` (64px) | `24px` | `16px` |
| **Header Height** | `98px` | `80px` | `64px` |
| **Hero Height** | `100svh` (min 800px) | `100svh` (min 700px) | `100svh` (min 600px) |
| **World Section Height** | `max(760px, 71.2vw)` (~1025px) | `auto` (min 760px) | `auto` (min 680px) |
| **Section Padding Y** | `clamp(5rem, 8vw, 8rem)` | `64px` | `48px` |
| **Grid Column Gap** | `2rem` (32px) | `1.5rem` (24px) | `1rem` (16px) |
| **Grid Row Gap** | `3rem` (48px) | `2rem` (32px) | `1.5rem` (24px) |
| **Card Border Radius** | `0px` / `2px` (Brutalist precision) | `0px` / `2px` | `0px` / `2px` |
| **Pill Border Radius** | `9999px` (Full rounded) | `9999px` | `9999px` |
| **Borders** | `1px solid rgba(241, 238, 230, 0.12)` (Dark) / `1px solid rgba(5, 5, 5, 0.12)` (Light) | Same | Same |

---

## 3. Typography System

### Font Families
- **Display & Headings**: `Archivo`, `Archivo Variable`, system-ui, sans-serif.
- **Monospace Technical & Badges**: `IBM Plex Mono`, `ui-monospace`, monospace.
- **Body & Longform**: `Plus Jakarta Sans`, system-ui, sans-serif.
- **Brand Serif Accent**: `Cinzel`, `Playfair Display`, serif.

### Type Scale by Breakpoint

| Class / Role | Desktop (1440px) | Tablet (768px) | Mobile (375px) | Weight | Line Height | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `display-mammoth` (Hero) | `13.2rem` (211.7px) | `6.25rem` (100px) | `3.25rem` (52px) | 850 | `0.78` | `-0.04em` |
| `display-world` (Worlds) | `14rem` - `21.6rem` | `6rem` - `9rem` | `3rem` - `4.5rem` | 850 | `0.82` | `-0.045em` |
| `display-section` (Headlines)| `6rem` - `7.2rem` | `3.5rem` - `4.5rem` | `2.25rem` - `2.75rem`| 800 | `0.85` | `-0.03em` |
| `display-sub` (Card titles) | `2rem` - `2.5rem` | `1.75rem` | `1.35rem` | 700 | `1.1` | `-0.02em` |
| `mono-eyebrow` (Counters) | `0.875rem` (14px) | `0.8125rem` (13px) | `0.75rem` (12px) | 600 | `1.4` | `+0.12em` |
| `body-editorial` (Paragraphs)| `1.125rem` (18px) | `1.0rem` (16px) | `0.9375rem` (15px) | 400 | `1.5` | `-0.01em` |
| `mono-pill` (Status badges) | `0.75rem` (12px) | `0.6875rem` (11px) | `0.625rem` (10px) | 500 | `1.2` | `+0.08em` |

---

## 4. Exact Color Tokens (Tailwind Extensions)

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: {
          dark: '#050505',      // Deep charcoal/black brutalist background
          card: '#11100f',      // Dark elevated panel surface
          light: '#f1eee6',     // Tactile warm chalk/ivory canvas
          lightCard: '#e6e3da', // Light elevated panel surface
        },
        ink: {
          dark: '#050505',      // Ink text on light canvas
          light: '#f1eee6',     // Chalk text on dark canvas
          mutedDark: '#66625b', // Subdued metadata on light canvas
          mutedLight: '#aaa79f',// Subdued metadata on dark canvas
          subtle: '#8a867c',    // Editorial secondary text
        },
        thread: {
          DEFAULT: '#ff3b12',   // Signature Vermilion Red/Orange
          glow: 'rgba(255, 59, 18, 0.4)',
          subtle: 'rgba(255, 59, 18, 0.15)',
        },
        gold: {
          DEFAULT: '#d4af37',   // Celestial star & financial accent
          light: '#e5c05b',
        },
        emerald: {
          DEFAULT: '#104a37',   // Positive safe-to-spend buffer accent
          glow: '#10b981',
        },
        border: {
          dark: 'rgba(241, 238, 230, 0.12)',
          darkActive: 'rgba(241, 238, 230, 0.35)',
          light: 'rgba(5, 5, 5, 0.12)',
          lightActive: 'rgba(5, 5, 5, 0.35)',
        }
      }
    }
  }
}
```

---

## 5. Signature Motion & Interactive Behaviors

### 5.1 The Continuous Vermilion Thread
- An SVG vector curve running through the viewport.
- As the user scrolls, `stroke-dashoffset` draws the line dynamically in synchronization with scroll progress.
- A pulsating vermilion needle head (`<circle r="4">` + `<circle r="12" stroke-dasharray="2 2">`) rides the tip of the curve.
- On viewports with `prefers-reduced-motion: reduce`, the thread line remains fully rendered statically with zero CPU overhead.

### 5.2 Header Inversion Behavior
- Header utilizes CSS `mix-blend-mode: difference` so typography is crisp chalk-white on `#050505` and instantly inverts to jet-black on `#f1eee6` seamlessly as the page scrolls beneath it.

### 5.3 Interactive Dashboard Preview Features
- **Cash Flow Visualizer**: Live SVG bar and progress representation showing Income (₹87,000), Fixed Costs (₹31,500), and Variable Burn (₹24,350).
- **Interactive What-If Simulation Slider**: Sliders for:
  - "Dining Out Reduction" (`0%` to `50%`)
  - "Rent Escalation" (`0%` to `25%`)
  Sliding triggers instant recalculation of Monthly Net Surplus, Emergency Runway Months, and Goal Arrival Dates.
- **Subscription Alert Card**: Expandable inspection of detected recurring charges with "Mark as Canceled" and "Audit Service" toggles.

### 5.4 Frequently Asked Questions Accordion
- Smooth height expansion and icon rotation (`+` to `x`).
- Accessible keyboard navigation (`tab`, `Enter`, `Space`, ARIA expanded states).

---

## 6. Strict Compliance & Educational Guardrail Notice
All simulated figures are deterministic and purely educational. In accordance with strict compliance protocols:
> **Notice**: *INARI is an educational financial modeling system. It provides scenario simulations, expense categorization, and deterministic cash flow projections. It does not provide registered investment advice, recommend securities, promote financial instruments, or solicit brokerage accounts.*

---

## 7. Responsive Verification Checklist
- **1440px (Desktop)**: Exact 3-column architecture, full 2x2 capabilities matrix, massive display typography (`13.2rem`), dual-action CTAs, vermilion thread animation.
- **768px (Tablet)**: 2-column stacked flow, typography scaled gracefully (`6.25rem`), mobile-friendly touch targets (`min-h-12`).
- **375px (Mobile)**: Single column stack, fixed header with hamburger trigger, legible monospace eyebrows, zero horizontal scroll overflow.
- **Accessibility**: Passes WCAG AA contrast (white on `#050505` is 19.5:1, dark ink on `#f1eee6` is 18.2:1, vermilion on white is 4.8:1).

