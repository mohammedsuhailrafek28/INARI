# INARI Frontend — The Living Money Model

A brutalist, high-craft landing page and interactive living financial model simulation interface for **INARI**, recreated pixel-close from the design architecture of `https://dakshgajjar.com/`.

---

## Overview

Unlike standard personal finance and budgeting apps that categorize transactions after money has already left your account and stop there, **INARI** builds an adaptive **"living money model"**. It digests bank statement exports (PDF, CSV, SMS), isolates fixed commitments from discretionary burn, computes deterministic emergency runway, flags recurring rate creeps and zombie subscriptions, and enables non-destructive What-If scenario simulations.

### Key Features
- **Brutalist Editorial Aesthetic**: Alternating deep brutalist black (`#050505`) and warm tactile chalk/ivory (`#f1eee6`) canvases, mammoth display typography (`Archivo`), and monospace technical annotations (`IBM Plex Mono`).
- **Signature Vermilion Thread**: Dynamic SVG spline (`#ff3b12`) that tracks scroll progress through every section with a pulsing beacon needle.
- **Interactive Product Preview Dashboard**:
  - **Live Cash Flow & Category Distribution Chart**: Real-time visualization of monthly inflow (₹87,000), fixed burn (₹31,500), and variable category spend.
  - **Goal Arrival Radar**: Dynamic completion timeline projections for Emergency Fund (6 Mo), Kyoto Sabbatical, and MacBook Pro Studio Rig.
  - **Interactive What-If Simulation Dials**: Real-time sliders ("Cut Dining Out Spend: 0% to 50%" and "Rent Escalation Shock") that recalculate monthly surplus and accelerate goal arrival dates in real-time.
  - **Subscription Sentinel Alert**: Automated detection of dormant recurring subscriptions with one-click audit and cancellation calculation (+₹2,499/mo).
- **The 6 Living Worlds**:
  - `01 / INGESTION` — Unstructured PDF, CSV, and SMS statement parsing.
  - `02 / RHYTHMS` — Fixed burn detection (Indiranagar rent ₹22k, utilities ₹1,420, broadband ₹999).
  - `03 / BUFFER` — Deterministic emergency runway protection (4.0 Mo liquid coverage).
  - `04 / WHAT-IF` — Composable, non-destructive life scenario simulation.
  - `05 / NUDGES` — Mid-month variable pacing drift alerts without moralistic judgment.
  - `06 / REVIEW` — Month-over-month financial audit and downloadable report.
- **Ethics & Non-Advisory Guardrails**: Clear statutory disclosures that INARI provides educational scenario simulations and never recommends specific securities, stocks, mutual funds, or cryptocurrencies.
- **Accessible & Responsive**: Fully verified across Desktop (`1440px`), Tablet (`768px`), and Mobile (`375px`).

---

## Tech Stack
- **Framework**: Vite + React 19 + TypeScript
- **Styling**: Tailwind CSS + Custom CSS Variables
- **Icons**: Lucide React
- **Animations**: Framer Motion & CSS SVG Spline Transforms
- **Fonts**: Archivo, IBM Plex Mono, Plus Jakarta Sans, Cinzel (Google Fonts)

---

## Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or higher, tested on v24.18.0)
- npm (v9.0.0 or higher)

### Quick Start

1. Navigate to the frontend directory:
   ```bash
   cd inari-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

4. Build for production:
   ```bash
   npm run build
   ```
   Compiles optimized production assets to `dist/`.

5. Preview production build:
   ```bash
   npm run preview
   ```
   Spins up local preview server at `http://localhost:4173`.

---

## Verification & Screenshots

Full-page screenshots captured at key responsive breakpoints:
- **Desktop (1440px)**: `inari-frontend/inari-1440.png`
- **Tablet (768px)**: `inari-frontend/inari-768.png`
- **Mobile (375px)**: `inari-frontend/inari-375.png`

---

## Compliance & Non-Advisory Notice

*INARI is an educational financial scenario simulation system. It does not provide certified investment advice, broker securities, or recommend investment assets. All calculations are deterministic Python models based on user-supplied data.*

