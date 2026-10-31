# INARI technical audit

Read-only audit. No application source was changed. Evidence levels used below: **S** implemented in source, **T** covered by unit/integration tests, **H** verified through HTTP against the production build in this audit, **B** verified in the browser (`/inari`), **—** not verified. "Missing" is stated explicitly.

## 1. Repository state

| Item | Value |
|---|---|
| Branch / HEAD | `feature/inari-demo-ui` / `0482fa5199ecd886bd319f8e3ac53f14433540a8` |
| Working tree | clean (the `docs/audit/` files written by this audit are the only additions) |
| Ancestry | `074b5fd` (`feature/novelty-pack`, published) and `backend` (`5e483ee`, published) are ancestors; `deploy/inari-demo` (`eb6a83d`) is an ancestor. Stash `stash@{0}` (WIP pdf-import) preserved |
| Remote state | `origin` has `backend` 5e483ee, `feature/novelty-pack` 074b5fd, `frontend`/`main` 330e40b. `feature/inari-demo-ui` is **local only** |
| Size | 368 tracked files; ~9.8k lines of non-test INARI server/shared code; 28 test files |
| Tests | 430 passing (re-run in this audit), `tsc --noEmit` clean, `vite build` OK, server bundle OK |

The repo is a **fork of the WealthVerse app** ("INARI baseline from WealthVerse cd75ef1"): the legacy `server/routers.ts` routers (`profiles`, `dashboard`, `spending`, `goals`, `wealth`, `advisor`, `ai`, …) and the entire legacy client still ship alongside the new `inari.*` router. The original WealthVerse repository was not touched.

## 2. Module map

| # | Area | Source | Core mechanism | Evidence | Genuine limitations |
|---|---|---|---|---|---|
| 1 | Ledger | `server/inari/ledger/{types,fileLedgerRepository,index}.ts` | `LedgerRepository` interface; one `FileLedgerRepository` (in-memory map, optional atomic JSON file). Every method takes `userKey`. Batches, fingerprints (`sha256(owner|base key|occurrence index)`), commit/undo, profile (goals, claims, rules, decisions) | S T H | Only memory or one JSON file. No database. JSON file is plaintext and "durable" only on a persistent disk |
| 2 | CSV import | `ingestion/csv.ts`, `csvImport.ts` | Header detection (`mapHeader`), debit/credit, signed-amount and bank-statement layouts, DD/MM/YYYY, integer paise, fingerprint dedupe | S T H B | English headers; one account per file; no bank-specific quirks beyond the three synthetic layouts |
| 3 | SMS import | `ingestion/sms.ts` | Regex field extraction; OTP, failed, pending, promotional → ignored; completed debit/credit → candidates | S T H | Bank formats are those in the synthetic/public dataset; unknown formats are *ignored*, not flagged |
| 4 | PDF import | `ingestion/pdfImport.ts` | `pdfjs-dist` text layer; position-grouped lines; header detection; Dr/Cr marker; running-balance chain check with next-row corroboration; evidence `{page,line}`; limits 5 MB / 60 pages / 150k items / 20 s | S T H | Digital PDFs only; 3 synthetic layouts; no OCR; real bank PDFs untested; parser runs in the server process (no sandbox) |
| 5 | Categorisation + learning | `categorize.ts`, `service.ts` (`correctCategory`) | Ordered regex rules → learned merchant rule → user correction (`user > learned > rule`); rule delete reverts only rule-derived rows | S T H | Rules, not a model; 22 fixed categories; "learning" = one rule per merchant key |
| 6 | Snapshot | `snapshot.ts` | Mean of up to 3 most recent *complete* months; income = salary/other_income credits; expenses = expense-category debits minus refunds; investments/savings/transfers neutral; balances never inferred (null) | S T H B | A card repayment is counted as an expense unless the user reconciles it; averages hide trend; reimbursement credits are income |
| 7 | Recurring | `recurring.ts` | Re-derived every call: same merchant, regular gap, steady amount, in subscription-like categories. Only confirm/dismiss decisions persisted | S T H | Produced a false "subscription" (HDFC card payment ₹4,500) and no price-increase flag on the demo CSV; cancel-simulation on it is arithmetically correct but semantically odd |
| 8 | Reconciliation | `reconcile.ts` (observe only) + `reconcile` procedure | Observes duplicates, card repayments, transfer pairs, refund-like credits as `dataQuality` notes; user explicitly excludes/keeps/undoes; rows never deleted | S T H | **No UI** in `/inari`; possible duplicates are imported by default (finding F-1) |
| 9 | Simulation | `simulate.ts` | Pure integer-paise arithmetic on the ledger-derived model: 7 scenario types, ≤5 combined; caps reductions at actual spend; no returns/inflation | S T H B | Linear model on a 3-month average; no investment returns; goal what-if only for user-entered goals |
| 10 | Goals | `goals.ts` | User-entered; projection = remaining / monthly contribution; ≤20 goals | S T H | No interest, no inflation (stated); no link to ledger savings |
| 11 | Monthly report | `report.ts` | Template narrative (`mode:"fallback"`), drift vs prior 3 months, ≤3 actions each citing transaction ids, partial-month flag, `insufficient_data` | S T H B | Month list is returned newest-first (UI previously defaulted to the oldest); partial flag fires on day 31 of 31 when data ends early |
| 12 | Refund / reimbursement claims | `claims.ts` | Claim linked to a debit; scoring of candidate credits (amount, merchant token, wording, 30-day window); confirmation allocates from a pool shared by all claims; undo, cancel | S T H | Claims **never change** snapshot/report totals; reimbursement credits stay income in base totals (documented, K10); no UI in `/inari` |
| 13 | Manual entries + coverage | `manual.ts` | Text/field preview (not stored in ledger), idempotent commit (`sha256(user|manual|key)`), batch `source:"manual"`, undo via `importUndo`; coverage gaps | S T H B | Free-text parser is regex (see NLP report); in-memory preview store |
| 14 | EMI check | `emi.ts` | Integer arithmetic; lists missing terms; never invents a rate; no ledger write | S T H B | Cannot derive an implied interest rate; no tax modelling |
| 15 | Advisor + NLP | `advisor.ts`, `nlp/intent.ts`, `guardrails.ts` | Two regex routers → handler → `FactBook` registers every printed amount → `guardText` blocks unregistered amounts / prohibited advice | S T H B | ~40% intent accuracy on unseen phrasing; see `INARI_NLP_EVALUATION.md` |
| 16 | Storage, persistence, isolation | `ledger/index.ts`, `identity.ts`, `owner.ts` | `INARI_LEDGER_STORE=memory|json`; user key `anon:<uuid>` from HMAC-signed cookie `v1.<uuid>.<sig>` | S T H | Memory by default (lost on restart); JSON survives restart only on persistent disk; single process; no locking across processes |
| 17 | Frontend ↔ backend | `client/src/pages/InariStudio.tsx`, `App.tsx` route, tRPC client `/api/trpc` with `credentials:"include"` | One self-contained page using `trpc.inari.*`; confirm cards call `proposedActions[].procedure` dynamically | S B | One page only; the rest of the client still calls legacy routers (see §4) |
| 18 | Deployment | `render.yaml` (commit `eb6a83d`, an ancestor of HEAD), `server/_core/index.ts`, `docs/DEMO_AND_DEPLOY.md` | Single Render web service; Express serves API + built SPA on one origin | S (config), H (local production-mode server) | Never deployed or exercised on Render; persistence is memory |

## 3. tRPC procedures (`PROCEDURE_STATUS` in `shared/inari/contracts.ts`)

All 41 procedure names (incl. 5 aliases) are marked `implemented`; none is a stub. Verification per procedure family:

| Family | Procedures | S | T | H (this audit) | B |
|---|---|---|---|---|---|
| Meta / snapshot | `meta`, `getSnapshot`, `setBalances`, `useDemoData`, `clearMyData` | ✔ | ✔ | `meta`, `getSnapshot`, `clearMyData` ✔; `setBalances`, `useDemoData` — | `getSnapshot` ✔ |
| Import | `importPreview`, `importCommit`, `importUndo`, `importHistory` | ✔ | ✔ | ✔ (CSV, SMS, PDF) | CSV ✔ |
| Transactions | `listTransactions`/`getTransactions` | ✔ | ✔ | ✔ | — |
| Categories | `getCategories`, `correctCategory`, `listLearnedRules`/`getLearnedRules`, `deleteLearnedRule`, `getBreakdown` | ✔ | ✔ | all but `getCategories` ✔ | — |
| Reconcile | `reconcile` | ✔ | ✔ | ✔ | — |
| Subscriptions | `listSubscriptions`/`getSubscriptions`, `confirmSubscription` | ✔ | ✔ | ✔ | — |
| Simulation | `simulate` | ✔ | ✔ | ✔ (7 scenario types) | ✔ (2 types) |
| Advisor | `ask`/`askAdvisor`, `analyzeIntent` | ✔ | ✔ | ✔ | `ask` ✔ |
| Reports | `monthlyReport`/`getMonthlyReport`, `listReportMonths` | ✔ | ✔ | ✔ | ✔ (see BR6) |
| Goals | `getGoals`, `upsertGoal`, `deleteGoal` | ✔ | ✔ | ✔ | — |
| Claims | `createClaim`, `listClaims`, `claimMatches`, `confirmClaimMatch`, `undoClaimMatch`, `cancelClaim` | ✔ | ✔ | ✔ (all six) | — |
| Manual / coverage / EMI | `manualEntryPreview`, `manualEntryCommit`, `dataCoverage`, `emiCheck` | ✔ | ✔ | ✔ | preview/commit/EMI ✔ |

Not exercised over HTTP in this audit: `setBalances`, `useDemoData`, `getCategories`, aliases. "Implemented" for these rests on source + unit tests only.

## 4. Frontend integration reality

- `/inari` is a **test harness**: import (CSV/PDF input), snapshot, advisor (type/dictate), what-if (2 of 7 scenario types), report, EMI. No UI for SMS, categories/corrections, reconcile, subscriptions, goals, claims, manual-entry history, undo, coverage.
- The remaining client (landing page, `/dashboard`, `/spending`, `/goals`, `/recommendations`, `/avatar`, onboarding) still calls **legacy WealthVerse routers** (`profiles.*`, `dashboard.getSummary`, `spending.*`, `goals.list`, `wealth.askAdvisor`, `ai.chat`, …) and shows persona data. They are not INARI features and must not be demoed as such.
- No separate teammate frontend working copy exists on this machine; the published `frontend` branch equals `main` (330e40b, the WealthVerse baseline). Whether the teammate has a newer private copy is **unknown**.
- Browser title and landing copy still say "WealthVerse" (`client/index.html`).

## 5. Deployment dependencies and security limitations (summary; detail in the security report)

- Needs `NODE_ENV=production`, `WEALTHVERSE_DEMO_MODE=true`, `WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION=true`, `JWT_SECRET`, `INARI_IDENTITY_SECRET` or every `inari.*` call returns 401 (observed in this audit's first browser run).
- Demo identity is an HMAC-signed anonymous cookie, **not authentication**; anyone with the cookie has the data.
- Memory store by default; no database; no backups.
- No rate limiting, no security headers (no CSP, `X-Powered-By: Express`).

## 6. Conclusion

The backend is a coherent, well-tested, deterministic finance engine whose headline numbers I could reproduce independently (snapshot, six monthly reports, reconciliation, subscription-cancel arithmetic, EMI, goal projections). Its weaknesses are at the edges: double-counting when previews containing "possible duplicates" are committed, rule-only NLP with low out-of-sample accuracy, and a frontend that exposes only a small slice of what exists. Detailed numbers are in the acceptance report.
