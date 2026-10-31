# INARI final design candidate

Branch: `integration/inari-final-design`. Base: local `release/inari-rc1` at `f6115b633e4cd8ea50814508aa1d6429e0a5624f`. Visual reference: remote `Swathi` at `8dccc0744e3e56819036a9776dfe159928620399`.

Remote heads were fetched and verified before work. `release/inari-rc1` is not published on origin; the requested local revision was used. Neither source branch was modified. No merge, push or deployment was performed. The main active checkout was not used for implementation or for running this candidate.

## Implementation

The existing React application now uses a single black / warm-ivory / vermilion design system. Self-hosted Archivo gives headings an editorial voice; readable sans-serif body text, accessible filled actions, generous card spacing and tabular amounts support financial tasks. The short landing explains ingestion, the living ledger, financial rhythms, goals, scenarios, claims and the advisor with an explicitly illustrative product-flow visual. No portfolio or property-management content was copied.

Swathi source recovery searched the full branch tree for the missing frontend directory, root src entry, source maps and matching design strings. Matching editable source was not present: the branch retained the old client/src tree and the new design in dist. No minified JavaScript is a production dependency. The approved palette, typography, alternating surfaces, restrained line motif and dashboard presentation were recreated in clean React and CSS.

Desktop application navigation is a 224px sidebar at 1280px and above. Laptop/tablet/mobile layouts avoid squeezed sidebar columns by collapsing to an in-flow navigation menu below that breakpoint. The same destinations, profile selection, persona onboarding and logout remain available. The original official logo geometry is retained with the new palette; navigation uses an INARI wordmark.

A new ledger summary and category visualization display existing backend outputs. Charts show units and currency. Unknown balances remain “Not provided”. The monthly trend remains sourced from backend monthly reports. No ledger arithmetic, database, external service or financial engine was added. Scenario controls clear stale results when edited and show goal completion dates from the server's simulation response.

## Features preserved

All original routes remain: landing, login, signup, persona selection, context-building, dashboard, import, spending, goals, recommendations, avatar advisor, support and INARI studio. The existing Express/tRPC backend remains authoritative.

CSV, PDF, SMS and .txt import; preview/confirm; exact and possible duplicates; history/evidence/undo; transactions, corrections and merchant rules; reconciliation; recurring payments; confirmed balances; cash entries; goals and projections; monthly reports; financial and cancellation scenarios; EMI reality check; refund/reimbursement claims; and advisor context are preserved. Imported-ledger advisor requests still use inari.ask. Its native textarea accepts ordinary or dictated text. No external language model or trained-model claim was introduced.

## Validation and limitations

**Browser acceptance: 30 passed, 0 failed.** The primary suite passes26/26, and persona/mobile interactions pass4/4. [Readable acceptance table](ACCEPTANCE.md).

See [acceptance-results.json](acceptance-results.json) for the complete primary browser journey and [acceptance-secondary.json](acceptance-secondary.json) for original-persona and mobile interaction checks. These tests drive controls and assert backend results; they are not rendering-only checks. Every changing fixture uses a separate demo identity where needed. All fixtures are synthetic.

The full backend regression run passed **460 / 461 tests**, across **30 passing test files and one failing file**. The sole failure is the pre-existing byte-integrity expectation in `server/inari/inari.dataset.test.ts`: it expects SMS corpus SHA256 `7a2a912b94c135c366154076985a6b4139971c5be61869f552fad81bd5762360`, but the corpus committed at the unmodified release-candidate revision hashes to `15ad367803331d0666ad6aac1846ec8355cf71689193d066447e33c26043e8dc`. This candidate has no server, shared-contract or data changes. The checksum assertion and attribution disagreement were not weakened or rewritten to claim a green regression suite.

TypeScript (`tsc --noEmit`) and the production build (`npm run build`) pass. Design detector findings for the new landing, summary/category visual, navigation and profile header: none. Independent visual finish review: **ship at inspected scope**, with no material findings. Retained secondary-page eyebrows and repetition of goal summaries are minor finish observations, not functional blockers.

Browser input compatibility was tested by inserting dictated-style text into the native mobile textarea and submitting it. An actual Wispr Flow desktop dictation session was not run. Demo identities are not production authentication; data remains in server memory and can disappear on restart. Synthetic data only. The inherited corpus checksum discrepancy prevents an unconditional all-checks-green release claim.

## Local review

The production application is running at **http://127.0.0.1:4320**. Open Import Center, load the included synthetic CSV, review and confirm. This gives your browser its own isolated demo ledger; test browser cookies are not committed.

Restart after a production build with `powershell -File scripts/start-final-demo.ps1`. Run browser tests with a separately installed Playwright module: set `PLAYWRIGHT_MODULE` to the module's absolute path, optionally set `INARI_BASE_URL`, then run `node scripts/final-design-acceptance.cjs` and `node scripts/final-design-secondary.cjs`. Chrome is used. No new dependency was added to the product's package manifest.

Screenshots: [gallery](screenshots.html), with full-page captures of all seven required routes at 1440x900, 1366x768, 768x1024 and 390x844, plus meaningful interaction states.

## Delivery decision

This is a stronger visual candidate than release/inari-rc1 while retaining its financial semantics and complete feature set. Browser acceptance covers the canonical import-to-dashboard-to-advisor journey and secondary financial workflows. It is suitable for local synthetic-data demonstration and review. A clean release gate still requires resolving the inherited corpus/attribution checksum discrepancy; no push, merge or deployment is authorized by this work.

## Application files changed

| File | Change |
|---|---|
| client/src/pages/Home.tsx | Concise, product-specific editorial landing and connected application CTAs |
| client/src/index.css | Shared palette, typography, surfaces, forms, responsive navigation, grid shrink behavior and reduced motion |
| client/src/components/layout/DashboardNavbar.tsx | Responsive sidebar/menu, active routes, profile control and session actions |
| client/src/components/layout/PublicNavbar.tsx | Wordmark and overflow-safe public navigation breakpoint |
| client/src/components/inari/LedgerOverview.tsx | Backend-fed monthly summary, category bars and section links |
| client/src/pages/Dashboard.tsx | Prominent imported metrics and charts; preserved original panels |
| client/src/pages/SpendingInsights.tsx | Section navigation and responsive summary columns |
| client/src/pages/GoalPlanner.tsx | Section navigation and responsive summary columns |
| client/src/pages/Recommendations.tsx | Section navigation and responsive summary columns |
| client/src/pages/AvatarAdvisor.tsx | Workspace skip target; inherited common presentation, native text input and existing requests preserved |
| client/src/components/inari/AppFrame.tsx | Workspace skip target and explicit font-size type hint |
| client/src/components/inari/kit.tsx | Panel presentation hook and larger form/action hit areas |
| client/src/components/inari/panels.tsx | Backend goal simulation dates, stale-result clearing, input labels and horizontal table containment |
| client/src/components/wealth/ProfileHero.tsx | Readable, responsive overview composition and clearer labels |
| client/src/components/wealth/FinancialMetricCard.tsx | Correct font sizing, shrinkable numeric/label layout |
| client/src/components/wealth/HealthScoreCard.tsx | Correct metric font-size hint |
| client/src/components/wealth/SectionHeader.tsx | Correct section-title font-size hint |
| client/src/components/wealth/TransactionList.tsx | Shrinkable transaction text column |
| client/src/assets/inari/inari-logo.svg | Existing mark geometry with the new palette |
| client/public/fonts/ | Self-hosted Archivo WOFF2 and SIL Open Font License |
| PRODUCT.md, DESIGN.md, .impeccable/design.json | Actual product constraints and durable design tokens |
| scripts/final-design-acceptance.cjs, scripts/final-design-secondary.cjs | Repeatable real-browser checks |
| scripts/start-final-demo.ps1 | Explicit local production demo startup |
| docs/final-design/ | Screenshots, acceptance evidence, visual review and handoff |

The last commit on this branch is the delivered integration commit; obtain its exact revision with `git log -1 --format=%H`.
