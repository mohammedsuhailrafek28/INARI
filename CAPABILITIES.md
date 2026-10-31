# INARI Capabilities & Integration Checklist

This document inventories every capability across the INARI platform: data ingestion, deterministic living money model, goal planner & what-if simulation, spending nudges, monthly review reporting, and the intelligence suite ported from `INARI-main` (Financial Health Score, Rule-based Recommendations, Contextual AI Advisor).

---

## 1. Statement Ingestion & Correction Loop
- [x] **CSV File Ingestion**: Ingest CSV bank/card statements with flexible column mapping, date parsing, and amount normalization (`POST /api/transactions/upload`).
- [x] **PDF Statement Ingestion**: Parse text-based bank statement PDFs and extract transaction records with date, description, and amount (`POST /api/transactions/upload`).
- [x] **SMS Transaction Ingestion**: Parse raw SMS alert strings (e.g. "INR 450 debited at Swiggy on 12-May...") into structured ledger entries (`POST /api/transactions/parse-sms`).
- [x] **Automated Rule-Based Categorization**: Auto-categorize incoming transactions into standardized categories (Food & Dining, Grocery, Transportation, Utilities, Rent, EMIs, Entertainment, Shopping, Healthcare, Travel, etc.).
- [x] **Interactive Transaction Table**: Search, filter by category/type, sort by date/amount, and view transaction details at `/dashboard/transactions`.
- [x] **Correction Loop & Category Learning**:
  - [x] Inline editing of category on any transaction.
  - [x] Save learned rule mapping merchant/keyword $\rightarrow$ user-selected category.
  - [x] Persist learned rules to `data/category_rules.json` so future imports automatically apply them.
  - [x] Trigger re-derivation/recomputation of profile and reports upon correction.

---

## 2. Recurring Payments & Subscription Sentinel
- [x] **Recurring Detection Engine**: Statistical identification of recurring debits using interval regularities and amount coefficient of variation (`GET /api/subscriptions`).
- [x] **Cadence & Next Expected Charge**: Displays cadence (Monthly, Weekly, Quarterly, Annual) and computes next projected charge date at `/dashboard/subscriptions`.
- [x] **Price Hike Alerts**: Flags subscriptions whose current debit increased by $>5\%$ vs baseline or prior period.
- [x] **"Apparently Unused" Subscription Sentinel**:
  - Heuristic: Identifies recurring subscriptions billed during the month where **zero complementary transactions or user activity** were detected in that category.
  - Clear in-UI explanation of the sentinel heuristic.
- [x] **Dormant Subscriptions**: Flags active subscriptions in profile with no debits observed for 60+ days.

---

## 3. Persistent Living Financial Profile
- [x] **Deterministic Derivation**: Automatically builds profile from historical transaction data and seed settings (`POST /api/profile/rederive`).
- [x] **Income Streams Architecture**:
  - [x] Distinguishes regular monthly salary from variable freelance/consulting.
  - [x] Editable sources, amounts, frequencies, confidence ratings, and active statuses.
  - [x] Add new income sources at `/dashboard/profile`.
- [x] **Fixed Costs & Commitments**:
  - [x] Rent, utilities, EMIs, subscriptions, and other recurring commitments.
  - [x] Editable items, amounts, categories, and recurrence status.
  - [x] Add new fixed costs at `/dashboard/profile`.
- [x] **Emergency Fund Living Model**:
  - [x] Target buffer in months of living expenses (1 to 24 months).
  - [x] Dynamic calculation: $\text{Target Amount} = \text{Monthly Expense Base} \times \text{Target Months}$.
  - [x] Current balance, funding status percentage, and liquid runway in months.
  - [x] Editable balance and target parameters with instant recalculation.
- [x] **Prioritized Financial Goals**:
  - [x] Multi-goal management with priorities: High, Medium, Low.
  - [x] Target date, target amount, current accumulated amount, and completion percentage.
  - [x] Add new goals, contribute funds directly, and remove goals.
- [x] **Immutable Versioning & Audit Log**:
  - [x] Every profile edit creates a new immutable version in SQLite (`profile_versions`).
  - [x] Preserves complete history across application restarts.
  - [x] Version history viewer displaying version numbers, timestamps, and summary change logs.
  - [x] Ability to inspect historical profile versions.

---

## 4. Goal Planner & What-If Simulation
- [x] **Month-by-Month Projection Engine**: Projects financial trajectory over configurable horizon (12 to 60 months, default 24).
- [x] **Priority Goal Funding Waterfall**:
  - Routes monthly surplus ($\max(0, \text{Net Cash Flow})$) sequentially to goals ordered by priority (`High` $\rightarrow$ `Medium` $\rightarrow$ `Low`) and deadline.
  - Computes exact projected completion date for every goal.
- [x] **Goal Outcome Classification**:
  - `✅ On Track`: Reaches target amount on or before target deadline.
  - `⚠️ At Risk`: Reaches target amount after target deadline.
  - `❌ Infeasible`: Zero or negligible allocation over projection horizon; will not complete without budget adjustments.
- [x] **6 Composable What-If Adjustments**:
  1. Category spend changes (% or ₹ amount, e.g. "cut dining out by 30%").
  2. Fixed cost changes (% or ₹ amount, e.g. "rent goes up by 10%").
  3. Income raises or additional income streams.
  4. New recurring expenses starting in month $M$.
  5. One-time lump sum expense occurring in month $N$.
  6. Goal adjustments (deadline or target amount).
- [x] **Quick Preset Triggers**:
  - "🍕 Cut Dining Out by 30%"
  - "📈 Rent Goes Up 10%"
  - "⚖️ Cut Dining 30% + Rent Up 10%"
  - "🔄 Reset All Adjustments"
- [x] **Dual Savings Trajectory Visualizer**: Recharts line chart comparing Baseline Cumulative Savings vs What-If Scenario Savings over time (`/dashboard/planner`).
- [x] **Side-by-Side Goal Outcome Matrix**: Detailed comparison table showing baseline vs scenario status, completion date, and timeline shifts (+/- months).
- [x] **Plain-Language Executive Summary**: Deterministic narrative generated strictly from computed numbers explaining cash flow delta, savings delta, and goal shifts.
- [x] **Non-Destructive Invariant**: What-if simulations run on deep-cloned instances and never mutate the persistent profile without explicit user confirmation.
- [x] **"Save Scenario as New Profile Version"**: Commits adjusted parameters to SQLite as a new active profile version (`POST /api/planner/commit-scenario`).

---

## 5. Spending Nudges & Pacing Alerts
- [x] **Mid-Month Spending Velocity Sentinel**: Projects end-of-month spend based on day-of-month velocity vs trailing 3-month averages (`GET /api/nudges`).
- [x] **Category Drift Warnings**: Specific alerts (e.g. "You're on track to overspend Dining by 22% this month") displayed at `/dashboard/nudges` and `/dashboard`.
- [x] **Cash Flow Cushion Warnings**: Flags when discretionary spending exceeds sustainable baseline surplus with direct "Simulate in Goal Planner" action links.

---

## 6. Monthly Review Reports
- [x] **Review Period Selector**: Dropdown to select any calendar month present in the transaction database at `/dashboard/reports`.
- [x] **Cash Flow Summary**:
  - Total Income, Total Spending, Net Savings, and Savings Rate.
  - Month-over-Month (MoM) change amounts and percentages.
  - Trailing 3-month baseline comparisons.
- [x] **Category Breakdown & Analytics**:
  - Ranked top spending categories with MoM movement.
  - Statistical outlier detection ($>1.5\times$ 3-month average or $>100\%$ MoM spike) with explanations.
  - Biggest MoM increases and decreases.
- [x] **Subscription & Recurring Audit**:
  - Categorization of recurring charges: New, Changed ($>5\%$), Unused Sentinel, Dormant.
- [x] **Spending vs Plan & Goal Pacing**:
  - Actual spending vs saved profile baseline spending (Surplus vs Deficit).
  - Emergency fund actual burn runway.
  - Goal pacing status (Ahead, On Track, Behind) and contribution forecast.
- [x] **2 to 4 Suggested Educational Actions**:
  - Framed as educational what-if scenarios with title, rationale, and projected financial benefit.
  - One-click "Simulate in Goal Planner" button that prefills the adjustments into the planner.
- [x] **Downloadable Exports**:
  - Standalone downloadable HTML report with inline responsive styling (`GET /api/reports/{month}/html`).
  - Downloadable PDF report with formatted KPI grids and tables (`GET /api/reports/{month}/pdf`).
- [x] **Compliance Guardrail**:
  - Automated check blocking specific securities, tickers (TSLA, AAPL, RELIANCE, TCS), mutual fund schemes, and crypto terms.
  - Prominent "Educational Tool, Not Financial Advice" notice across UI and exports.

---

## 7. Integrated Capabilities Ported from `INARI-main`
- [x] **Multi-Factor Financial Health Score (0–100)**:
  - Ported from `INARI-main/server/financialEngine.ts` to `GET /api/health-score`.
  - Calculates sub-scores for Savings (25 pts), Emergency Buffer (25 pts), Debt/Fixed Costs (25 pts), and Goal Progress (25 pts).
  - Visible on `/dashboard/advisor` and top-level summary cards.
- [x] **Rule-Based Recommendation Engine**:
  - Ported from `INARI-main/server/wealth/recommendationEngine.ts` to `GET /api/recommendations`.
  - Generates ranked tactical cards (e.g., Emergency Buffer Bolstering, Subscription Audit, Goal Acceleration) with expected financial impact, effort rating, and actionable triggers.
  - Visible on `/dashboard/advisor`.
- [x] **Contextual AI Financial Advisor**:
  - Ported from `INARI-main/server/wealth/advisorEngine.ts` to `POST /api/advisor/ask`.
  - Interactive conversational assistant aware of active profile version, emergency runway, savings rates, and priority milestones.
  - Visible on `/dashboard/advisor` with clickable prompt shortcuts.
- [x] **Spending Velocity & Behavioral Alerts**:
  - Ported from `INARI-main/server/wealth/alertEngine.ts` and integrated with mid-month pacing nudges at `/dashboard/nudges`.
