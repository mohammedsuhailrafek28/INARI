# INARI Backend Audit (of the WealthVerse repository)

Audit date: 2026-10-31 (Sat) 14:xx IST. Deadline: 2026-10-31 23:59 IST, which is **the same day, roughly 9.5 hours away**.
Mode: read-only. Nothing in the repository was modified, installed, migrated, committed or deployed.

## 0. How to read this report

Every statement is tagged:

- **[V]** Verified: I read the code or ran the command and saw the result.
- **[A]** Assumption or inference: not directly confirmed. Each one lists how to confirm it.

### 0.1 What was audited

| Item | Finding |
|---|---|
| Session working directory | an unrelated local folder contains only `atlas-agents` (a Python agent platform) and `releases`. It is **not** WealthVerse and has no INARI code. [V] I did not audit it. |
| The repo audited | `<local checkout of the WealthVerse repository>` (name in `package.json`: `wealthverse`; README title: WealthVerse). [V] You called it "WealthWise"; this is the only matching repo on the machine. Other hits: `wealthverse-project` (only Crashpad files) and `wealthverse-frontend` (a frontend-only fragment, not audited). |
| Target folder for INARI | `<local INARI folder>` was empty. [V] The four reports are written there, deliberately outside the repo. |
| PS04 problem statement | **Not present anywhere I could read.** Requirements below come from your task list, not the official PS04 text. [A] Please paste the PS04 statement so scoring criteria can be checked against the gap analysis. |

### 0.2 Main-branch safety (your "preserve main" requirement)

- Branch `main` at `cd75ef1` ("style(ui): final hackathon polish"), identical to `origin/main`; remote `https://github.com/mohammedsuhailrafek28/wealth-verse.git`. [V]
- Working tree clean (`git status --porcelain` empty) before **and** after I ran `vitest` and `tsc`. [V]
- 275 tracked files, 12+ commits, latest commit 2026-07-13. [V]
- Recommended guard (not yet done, needs your OK): do all work on a new branch such as `inari/ps04`, never commit on `main`, and optionally tag `main` as `wealthverse-main-final` before starting.

## 1. Stack and shape

| Layer | Tech [V] |
|---|---|
| Runtime | Node, Express 4, **tRPC 11 + superjson**, Zod 4, TypeScript 5.9 |
| Persistence | Drizzle ORM + `mysql2` (MySQL/TiDB) **optional**; in-memory/JSON "persistence provider" for advisor-side state |
| Frontend | React 19, Vite 7, wouter, TanStack Query, Tailwind 4 (served by the same Express process) |
| Auth | Manus-style OAuth + JWT cookie (`jose`), with a **demo-mode bypass** |
| LLM | "Forge" (Manus) OpenAI-compatible endpoint via `server/_core/llm.ts`, optional |
| Tests | Vitest, 10 files / 69 tests, all server-side |
| Deploy | `render.yaml` (Render free web service), `pnpm build` = `vite build` + `esbuild` bundle |

"AP procedures" is read as **API procedures**. The API is entirely tRPC under `/api/trpc`; there are no REST routes except `/api/health`, the OAuth callback and a storage proxy. [V]

## 2. API procedure inventory (`server/routers.ts`)

All data procedures use `protectedProcedure` (needs `ctx.user`). In demo mode every unauthenticated caller is given `user.id = 0` (see 6.1). [V]

| Procedure | Type | Source of data | Side effects |
|---|---|---|---|
| `system.health`, `system.notifyOwner` | q / m(admin) | env | notifyOwner calls Forge |
| `auth.me`, `auth.logout` | q / m | cookie | clears cookie |
| `profiles.list`, `profiles.getById` | q (public) | `demo_profiles` or in-code fallback | none |
| `profiles.setActive`, `profiles.getActive` | m / q | `user_profiles` or in-memory Map | setActive writes |
| `dashboard.getSummary` | q | profile row, health engine, streak, badges | **writes** `financial_health_scores` on every read |
| `spending.getBreakdown / getUnusual / getOpportunities` | q | `transactions` (limit 100) | none |
| `goals.list` | q | `goals` table | none |
| `recommendations.list` | q | rule engine over profile row | none |
| `alerts.list` | q | `alerts` table | none |
| `transactions.recent` (50) / `summary` | q | `transactions` | none |
| `wealth.getContext / getInsights / getRiskProfile` | q | `buildWealthContextForUser` | getContext publishes events |
| `wealth.getPredictions / getMonthlyOutlook` | q | prediction bundle | publish events + telemetry |
| `wealth.askAdvisor`, `advisor.ask` (duplicate logic) | m | NLP + context + memory + optional LLM | events, memory write |
| `wealth.analyzeQuestion` | q | NLP only | none |
| `wealth.getEvents / getEventTimeline / clearEvents` | q / m | event bus | clear |
| `wealth.getNotifications / UnreadCount / markRead / markAllRead / dismiss / clear / getNotificationDigest` | q / m | notification store | state changes |
| `wealth.getMemory / clearMemory / getPreferences / updatePreferences` | q / m | memory store | state changes |
| `wealth.getPersistenceHealth / getSystemHealth / getTelemetry* / clearTelemetry` | q / m | in-process | none |

Observations:

1. `advisor.ask` and `wealth.askAdvisor` contain ~40 duplicated lines. [V]
2. `advisor.ask` accepts `dashboardSummary`, `spendingBreakdown`, `goals`, ... as `z.unknown()` and **ignores them**. [V]
3. `getOrCreateActiveDemoProfileId` is duplicated in `routers.ts` and `wealth/contextBuilder.ts`. [V]
4. **No procedure anywhere writes a transaction, goal, balance or profile figure.** The only writes in `db.ts` are `upsertUser`, `setUserActiveProfile` and `updateFinancialHealthScore`. [V]
5. `trpc.ai.chat` appears only in a doc comment and the component showcase; **no `ai` router exists**. [V]

## 3. Financial data models (`drizzle/schema.ts`)

All tables are MySQL via Drizzle. Migrations: `0000_bent_mysterio.sql`, `0001_mixed_molten_man.sql`. [V]

| Table | Key columns | Notes for PS04 |
|---|---|---|
| `users` | openId, role | OAuth identity |
| `demo_profiles` | monthlyIncome, monthlyExpenses, **savingsRate**, investmentBalance, emergencyFundBalance, creditCardDebt, riskProfile (conservative/moderate/aggressive), age, occupation | **The headline numbers are stored here as static values, not derived from transactions.** |
| `user_profiles` | userId, demoProfileId, isActive | Maps a user to a demo persona |
| `transactions` | **demoProfileId** (no userId), date, category enum(12), amount decimal(12,2), type enum(income/expense/investment), description varchar(255) | No account, merchant, currency, source, import batch, hash, balance, or confidence fields. Category is a closed enum. |
| `goals` | demoProfileId, goalType enum(house/car/education/emergency_fund/retirement), targetAmount, currentAmount, timelineMonths, priority | `currentAmount` is static; nothing updates it. Five goal types only. |
| `recommendations` | demoProfileId, reasons json, category | **Read path exists but is unused**: recommendations are regenerated from rules each call. [V] |
| `alerts` | demoProfileId, alertType enum(4), severity | Seed-only. |
| `savings_streaks`, `badges`, `financial_health_scores` | demoProfileId | Gamification and a score cache that is written but never read for the UI. [V] |

Money is returned from MySQL as `decimal` strings and converted with `parseFloat` everywhere (floating-point rupees, no paise integers). [V]

In-code TS types (`server/wealth/types.ts`): `WealthContext`, `WealthGoal`, `WealthTransaction`, `WealthInsight`, `WealthRecommendation`, `WealthAlert`, `WealthRiskProfile`, `AdvisorResponse`. `WealthContext` is the single object that feeds the dashboard, advisor, predictions and notifications. [V]

## 4. Transaction structures and flows

- Read: `getTransactionsByProfile(profileId, limit=100)` newest-first; `getMonthlyTransactionSummary` (despite the name, sums **all** rows, not a month). [V]
- `getSpendingBreakdown`: sums `type==="expense"` rows from the **latest 100 rows, all months mixed**. [V]
- `getUnusualExpenses`: mean + 2 sigma over those same rows, top 5. [V]
- `getSavingsOpportunities`: fixed percentages: subscription 20%, entertainment 15%, food 10%. [V]
- The contexts' `recentTransactions` use `limit=8`. [V]
- **Demo fallback data** (when no `DATABASE_URL`): 12 hard-coded transactions, 3 profiles, 4 goals, 2 alerts. `seedDemoData.mjs` (MySQL seeding script, uses `Math.random`) creates **4** profiles and ~60 days of random transactions, so fallback and seeded data differ. [V]

## 5. Persistence behaviour

Three independent mechanisms exist. They are easy to confuse.

| # | Mechanism | Used for | Durability |
|---|---|---|---|
| 1 | MySQL via Drizzle (`getDb()`; only if `DATABASE_URL` set) | users, demo profiles, transactions, goals, alerts, health cache | Durable if DB is configured. **Production `render.yaml` does not set `DATABASE_URL`** [V], so production runs on mechanism 2. |
| 2 | In-code arrays in `db.ts` + `activeDemoProfiles` Map, active only when `ENV.isDemoMode && !DATABASE_URL` | everything above, read-only | Lost on restart; profile selection is a process-global Map |
| 3 | `PersistenceProvider` (`memory` default, or `json` file at `.runtime/wealthverse-data/persistence.json`) | advisor memory, preferences, events, notifications (domain `predictions` is declared but I found no consumer [V]) | Memory: volatile. JSON: single file, read-modify-write per op with tmp+rename, **no locking**, ignored for corrupt files, local/dev only (code warns against production). |

Telemetry is in-memory only. [V]
On Render's free plan the disk is ephemeral, so `json` mode would not survive redeploys either. [A] confirm with Render docs/plan.

Import-relevant conclusion: there is **no durable, user-scoped place to store imported transactions today**. A new ledger store is required (see PS04_GAP_ANALYSIS).

## 6. Auth and tenancy

### 6.1 Demo-mode identity (critical for real financial data)

`createContext` assigns `{id: 0, openId: "local-demo-user"}` to every unauthenticated request when `ENV.isDemoMode`. [V] All persistence keys (`memory`, `events`, `notifications`, `preferences`) are the user id, so **every visitor shares one advisor memory, one notification inbox and one active persona**. [V] `render.yaml` ships production with `WEALTHVERSE_DEMO_MODE=true` and `WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION=true`. [V]

Consequence: if import is added unchanged, **one visitor's uploaded bank statement would be visible to every other visitor and would be wiped or merged unpredictably**. This must be solved first (per-browser anonymous identity or real auth) before any real-data import ships.

### 6.2 Other

- `JWT_SECRET` required in production; the code throws at boot without it. [V]
- Session cookie lifetime is one year. [V]
- No rate limiting, no CORS config, no Helmet. `express.json({limit:"50mb"})` is global. [V]
- Several state-changing procedures (`clearEvents`, `clearMemory`, `clearTelemetry`) are available to any demo caller. [V]

## 7. Existing intelligence components

### 7.1 Financial health (`financialEngine.calculateHealthScore`)
Four components capped at 25 each: savings (`savingsRate*0.25`), investment (`balance / monthlyIncome * 10`), debt (`25 - debt/income*25`), emergency fund (`months * 4.17`). Deterministic and reusable. **Inputs come from the profile row, not from the ledger.** [V]

### 7.2 Spending prediction (`wealth/predictions/*`)
Rule-based, not statistical. Spending forecast multiplies the category total by fixed factors (x1.12 if flagged unusual, x1.03 if share >40%, minus the opportunity amount, else flat). Goal forecast = remaining / max(`target/timeline`, 20-35% of surplus). Health forecast = hand-tuned deltas. Monthly outlook = surplus minus spending delta. [V] Weakness: category totals are **not normalised per month**, so multi-month imports would be treated as one month's spend. Assumptions text says "demo values". Output shape (`PredictionBundle`) is sound and reusable.

### 7.3 Advisor memory (`wealth/memory/*`)
Rolling 20 exchanges per user plus a 5-field preference profile (risk tolerance, investment interest, language=`english` literal, voice flag, goal priority). Used to bias wording and goal contribution (x1.15). **Nothing is learned from user corrections**, and memory is volatile in default mode. [V]

### 7.4 Notification and recommendation engines
- Events: typed in-memory bus capped at 100 per user; 11 event types. Notifications derived by rules (`notificationRules.ts`), deduped by `metadata.dedupeKey` (replace-on-same-key), 100 cap, expiry. Digest builder exists. [V]
- Recommendations: ~7 rule blocks (emergency fund <3 months, SIP if savings rate >25%, debt >0.5x income, ...). Each carries reasoning, effort, risk, priority, disclaimer. Reusable and explainable. [V]
- Insights and alerts: rule-based, similar structure. Alerts concatenate stored (seeded) alerts with generated ones. [V]
- Risk profiler: score 0-100 from savings rate, surplus, health, goal pressure, volatility. [V]

### 7.5 NLP / LLM
- NLP is **keyword/regex only** (`intentClassifier.ts`, 14 intents, English, `includes()` checks, hand-written synonym map, entity lists hard-coded). `moneyValues` are extracted but **not consumed by any engine** I could find (grep: only defined and returned). [V]
- LLM: `answerWealthAdvisorQuestion` calls `invokeLLM` (Forge chat completions, model `gpt-4o-mini`, JSON mode, 900 tokens) only if `BUILT_IN_FORGE_API_KEY` is set; otherwise, or on any error or bad JSON, returns the deterministic response. [V]
- The LLM prompt contains the full `AdvisorSessionContext` (profile, balances, transactions, memory) as JSON with no redaction. [V] Fine for synthetic data, a privacy issue for real data.
- LLM output is shape-validated but **not content-validated** (no check that numbers match the context, no banned-advice filter beyond a system-prompt sentence). [V]
- `llm.ts` already supports `file_url` content (PDF mime) and JSON-schema output, which could be used for PDF extraction, but it targets a third-party service. [V]
- Voice: the UI uses browser TTS/STT (`VoiceControls.tsx`). A server `voiceTranscription.ts` helper exists but is not exposed through any router. [V]

## 8. Tests and quality gates

| Check | Result |
|---|---|
| `vitest run` (with `WEALTHVERSE_DEMO_MODE=true`) | **10 files, 69 tests, all passed**, 7.3 s [V] |
| `tsc --noEmit` | exit 0 [V] |
| Coverage tool | none configured [V] |
| Client tests | none [V] |
| CI | no `.github` directory in the repo [V] |
| DB code path (`db.ts` with real MySQL) | untested; every test runs on the in-code fallback [V] |
| Build (`pnpm build`) | **not run** (writes `dist/`) [A] |
| Per-area test counts | route contracts 1, engines 10, events 9, memory 8, NLP 6, notifications 10, persistence 9, predictions 8, telemetry 7, auth 1 |

Tests are contract/smoke heavy; none exercises numeric correctness of the health score, forecasts or breakdown against hand-computed fixtures. [V]

## 9. Security and deployment risks

| ID | Risk | Severity | Evidence |
|---|---|---|---|
| R1 | **Plaintext secrets on disk** in `.project-config.json`: a DB connection string with credentials (TiDB Cloud), temporary AWS keys (listed expiry 2026-06-18), JWT secret, Forge API key, frontend Forge key. File is gitignored (`.gitignore:117`) and not tracked; a `git log -S` search for the DB host found no history hit. Still, the values were printed in this audit session's tool output. **Treat them as exposed: rotate them.** I have not copied any value into the reports. | High | [V] |
| R2 | Demo-mode shared identity in production (6.1) | High for real data | [V] |
| R3 | No durable store configured in production; all imported data would vanish on restart | High | [V] |
| R4 | Real financial data sent unredacted to a third-party LLM | High | [V] |
| R5 | Global 50 MB JSON body limit, no rate limiting | Medium | [V] |
| R6 | Free Render plan spins down when idle; in-memory state (memory, events, notifications, active persona) resets | Medium | [A] Render behaviour; in-memory reset is [V] |
| R7 | `dashboard.getSummary` mutates the DB on a GET-like query | Low | [V] |
| R8 | Adding dependencies (PDF parser, etc.) requires `pnpm install` and a lockfile change, and the Render build uses `--frozen-lockfile` | Medium | [V] |
| R9 | Python 3.12/3.13 and Node 24 are installed locally; Render service runtime versions are unpinned (`render.yaml` has no node version) | Low | [V]/[A] |
| R10 | Stray devDependency `add` in package.json (no known purpose) | Info | [V] |

## 10. Environment variables

Existing (from `env.ts`, `.env.example`, `render.yaml`):

| Variable | Needed for | Status in prod config |
|---|---|---|
| `NODE_ENV` | mode | set |
| `JWT_SECRET` | sessions (boot fails without in prod) | `sync:false` (must be set manually) |
| `WEALTHVERSE_DEMO_MODE`, `WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION` | demo bypass | both `true` |
| `WEALTHVERSE_PERSISTENCE` | `memory` / `json` | `memory` |
| `WEALTHVERSE_LOG_LEVEL` | logging | unset |
| `DATABASE_URL` | MySQL | **not set** |
| `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | OAuth | not set |
| `OWNER_OPEN_ID` | admin mapping | not set |
| `BUILT_IN_FORGE_API_URL/KEY` | LLM, storage, voice, maps, notifications | not set (fallback mode) |
| `VITE_FRONTEND_FORGE_API_URL/KEY` | maps | not set |
| `PORT` | listen port | Render injects |

New variables INARI would need are listed in IMPLEMENTATION_PLAN section 6.

## 11. Direct answer: does the architecture let an import drive all dashboard, goal and advisor numbers?

**No, not today. [V]** Traced through code:

1. `getProfileMetrics()` (the root of the health score, recommendations, risk, alerts, predictions and all advisor figures) reads **only the `demo_profiles` row**. Income, expenses, savings rate, investment balance, emergency fund and card debt are static columns.
2. `buildWealthContextForUser` pulls spending breakdown, unusual expenses, opportunities and recent transactions from transactions, but `monthlyIncome`, `monthlyExpenses`, `monthlySurplus`, `savingsRate`, `financialHealthScore`, `metrics`, alerts about emergency fund and every recommendation still come from the profile row.
3. Goals read `goals.currentAmount`, which nothing updates.
4. Transactions are keyed by `demoProfileId`, not by user.

So an imported ledger written in today's table would change only the spending charts and the "unusual expense" list; the headline health score, savings rate, surplus, goal progress, recommendations and advisor answers would keep showing the synthetic persona. It would also create inconsistent screens (a spending total that disagrees with "monthly expenses").

**What makes it possible with modest change:** the architecture is well factored around two seams, `getProfileMetrics()` (financial inputs) and `buildWealthContextForUser()` (aggregate). If a new `FinancialSnapshot` derived from an imported ledger is substituted at those seams, every downstream engine (health, insights, alerts, recommendations, risk, predictions, advisor, notifications) recomputes without further changes. The engines only consume `FinancialMetrics`, `WealthGoal[]`, `WealthTransaction[]` and a spending map. Balances (emergency fund, investments, card debt) cannot be derived from transaction lists alone; they need user input or statement closing balances. Details in PS04_GAP_ANALYSIS section 3.

## 12. Reuse summary (one-line)

Reuse as-is: health score formula, risk profiler, insight/alert/recommendation engines, prediction types and bundle, advisor response shape, event bus, notification rules and digest, persistence-provider interface, `invokeLLM`, formatters, route-contract test style.
Adapt: `getProfileMetrics`, `getSpendingBreakdown`, `getUnusualExpenses`, `getSavingsOpportunities`, goal contributions, `buildWealthContextForUser`, spending forecast, auth identity, persistence for ledger, advisor LLM prompt (redaction, validation).
Missing entirely: see PS04_GAP_ANALYSIS.
