# INARI Implementation Plan

Written 2026-10-31 around 14:20 IST. **Hard deadline: 2026-10-31 23:59 IST: same day.** Available time after you approve this plan is roughly 8.5-9 hours, and the work is done by one backend lead (plus the parallel frontend developer).
Nothing here has been started. No implementation begins until you review the four reports and say go.

## 1. Feasibility, stated plainly

The full capability list (CSV + PDF + SMS + normalization + dedupe + correction + learning + subscriptions + simulations + reports + guardrails + Python LLM service + durable multi-user storage) is **not realistically finishable and testable in 9 hours**, especially at the quality bar "verified, not assumed". The plan therefore has a cut line:

| Tier | Meaning | Items | Target |
|---|---|---|---|
| **P0** must ship | Core claim "import drives everything" works end to end and is safe | contracts + stub router, identity isolation, ledger store, CSV parser, normalization, dedupe, category rules + correction, snapshot derivation, wiring into context/dashboard/goals/advisor, balances input, basic guardrails + redaction, monthly report (JSON), tests | by 20:30 |
| **P1** should ship | Differentiators | SMS parser, subscription detection, simulations, learning (rule-based), report narrative, advisor intents (simulate/report/subscriptions) | by 22:15 |
| **P2** only if time | Stretch | Python LLM service (merchant categorisation + narration), PDF text extraction, MySQL ledger implementation, CI + coverage | else documented as "designed, not built" |
| Not in scope | | Scanned-PDF OCR, bank connections/Account Aggregator, real LLM quality tuning, mobile SMS reader app | |

If at 18:30 P0 is not green, drop P1/P2 entirely and spend remaining time on hardening P0 and the demo path.

## 2. Decisions needed from you before coding (blocking)

| ID | Decision | Recommendation | Why it matters |
|---|---|---|---|
| D1 | Where does the ledger live? (a) in-memory + JSON file via existing persistence provider, (b) MySQL/TiDB via Drizzle | **(a) first, behind a `LedgerRepository` interface; (b) as P2.** | Production has no `DATABASE_URL` [V]; a DB needs a migration, credentials, and untested DB code path. With (a) on Render free, imported data disappears on restart/spin-down. Acceptable for a judged demo only if stated. |
| D2 | User identity | **Anonymous per-browser id (signed httpOnly cookie) in demo mode; keep OAuth for logged-in users.** | Today every visitor is user 0 [V]; importing real statements without this leaks data between visitors. |
| D3 | Scope of formats on demo day | CSV certain; SMS likely; PDF stretch | See cut line |
| D4 | Are real bank samples available? | Please supply 1-2 sanitised CSVs and ~20 SMS | Without them, "supports bank X" claims stay [ASSUMPTION] |
| D5 | Language | English only unless PS04 demands Hindi | Keeps NLP scope small |
| D6 | LLM provider and key for Python service | Decide or skip; deterministic fallback always present | No key seen anywhere that I may use |
| D7 | PS04 statement | Paste it | Gap analysis is built from your list |

Human tasks (cannot be done by the agent): **rotate the secrets found in `.project-config.json`** (DB credentials, Forge key, JWT secret; AWS temp creds already expired per their own timestamp), create the branch/tag if you want it done under your identity, provide samples, run the final Render deploy and set env vars.

## 3. Branching and safety rules

1. `main` (`cd75ef1`) is never touched. [Verified clean at audit time]
2. Optional tag `wealthverse-main-final` on `cd75ef1` before work (your approval).
3. All work on branch `inari/ps04`; feature commits small; push only the branch.
4. Render: deploy from the `inari/ps04` branch into a **separate Render service** (not the existing one) or a preview; the current production service stays on `main`.
5. Everything additive: existing `wealth.*`, `dashboard.*` etc. keep their shapes; `inari.*` is new; `dataSource` fields are optional additions. Existing 69 tests must stay green at every commit.
6. No dependency additions without your approval (needed for PDF text, coverage). CSV and SMS need none.
7. Feature flags via env (`INARI_FEATURES`), all new capabilities default off in `main`-compatible config.

## 4. Work breakdown and schedule (IST, assuming go at ~15:15)

Times are budgets. Every block ends with its acceptance tests passing (IDs refer to PS04_GAP_ANALYSIS) and a commit.

### Phase 0: Gate and setup (15:00-15:30)
- You review reports, answer D1-D7, rotate secrets.
- Create branch; run baseline `vitest` + `tsc` and record (already done at audit: 69/69, tsc 0).
- Add characterization tests that lock in current behaviour: AT-FLOW-01, AT-GRD-04, AT-NLP-03.

### Phase A: Foundation and unblock the frontend (15:30-17:00) [P0]
1. `shared/inari/contracts.ts` (from APA_CONTRACT_PROPOSAL) + `fixtures.ts`; `inari` router with stub implementations (`INARI_STUB`). **Frontend dev unblocked at ~16:00.** Compile check with `tsc`.
2. Identity: anonymous signed cookie id in `createContext` for demo mode (D2). AT-FLOW-06.
3. Domain: `NormalizedTransaction`, `LedgerRepository` (in-memory + JSON through the existing provider; per-user key `ledger`), integer-paise helpers.
4. CSV parser + bank profiles + normalization + dedupe + preview/commit/undo. AT-CSV-01..06, AT-NORM-01..04, AT-DEDUP-01..04.

### Phase B: Make import drive everything (17:00-18:30) [P0]
5. `deriveSnapshot()` (trailing complete months, provenance flags) + `setBalances` + `getSnapshot`.
6. Wire seams: `getMetricsForUser`, month-windowed spending functions, `buildWealthContextForUser` chooses `imported`/`demo`; goals from user-owned store; `dashboard.getSummary`, `spending.*`, `goals.list`, `transactions.*`, `recommendations.list` read through the same resolver. Add `dataSource`/`dataAsOf`. AT-FLOW-02..05.
7. Category rules (taxonomy), correction mutation, recompute. AT-CAT-01..05.
**Gate at 18:30: P0 data path green or cut P1/P2.**

### Phase C: Safety, reports (18:30-20:30) [P0]
8. Guardrails module: policy classifier (investment-picking/guarantee/out-of-scope), redactor, number-consistency check, injection-safe prompt assembly; used by the advisor path. AT-GRD-01..06.
9. Monthly report builder (JSON) + deterministic narrative. AT-REP-01..04.
10. Hardening: per-route body limits, rate limit for import routes, error codes, telemetry events for import. 

### Phase D: Differentiators (20:30-22:15) [P1]
11. Subscription detection AT-SUB-01..04.
12. Simulations AT-SIM-01..05 and advisor intents `simulate` / `monthlyReport` / `subscriptions` (AT-NLP-02).
13. SMS parser AT-SMS-01..04.
14. Learned rules (rule-based) AT-LEARN-01..03.

### Phase E: Stretch (only if Phase D finished before 21:30) [P2]
15. Python `services/inari-llm` skeleton (FastAPI `/healthz`, `/v1/categorize` with stub provider, shared secret), Node adapter with timeout and fallback. AT-PY-01..04.
16. PDF text extraction (needs approved dependency) AT-PDF-01..03.

### Phase F: Integrate, verify, deploy (22:15-23:30)
- 22:15 **Feature freeze.** Only bug fixes after this.
- Full run: `tsc`, `vitest` (all old + new), `pnpm build` (not yet run in audit), local production-mode smoke (`NODE_ENV=production`) with a scripted end-to-end: import fixture -> check dashboard JSON -> correct category -> simulate -> report -> advisor question.
- Deploy `inari/ps04` to a separate Render service; set env vars (section 6); hit `/api/health`; repeat the scripted flow against the deployed URL; confirm second browser sees demo data (AT-FLOW-06).
- 23:30 submit. 23:30-23:59 buffer only. Do not deploy in the last 15 minutes.

## 5. Test strategy

- Unit tests, Vitest, same folder convention as the repo (`server/inari/**/*.test.ts`; `vitest.config.ts` already includes `server/**/*.test.ts`) [V].
- Golden fixtures: synthetic CSV statements (3 banks' formats), SMS set, expected JSON snapshots computed **by hand/spreadsheet independently of the code** (otherwise tests only prove self-consistency).
- Route contract tests in the style of `routeContracts.test.ts`, per `inari.*` procedure.
- Property-style checks: parse -> normalize idempotence; import twice == once; totals partition (accepted+rejected+duplicates+ignored == total).
- Regression: the 69 existing tests run in CI order first.
- Label every acceptance test in the final report as VERIFIED (ran green, with evidence) or ASSUMPTION (needs real data/service). Real-bank-format claims, live LLM quality, Render restart behaviour and PDF accuracy stay ASSUMPTION unless evidence is produced.

### Traceability: feature -> tests -> tier

| Feature | Tests | Tier |
|---|---|---|
| Import drives all numbers | AT-FLOW-01..07 | P0 |
| CSV | AT-CSV-01..07 | P0 |
| Normalization | AT-NORM-01..04 | P0 |
| Dedupe | AT-DEDUP-01..05 | P0 |
| Category correction | AT-CAT-01..05 | P0 |
| Guardrails | AT-GRD-01..07 | P0 |
| Monthly report | AT-REP-01..04 | P0 (JSON) |
| SMS | AT-SMS-01..05 | P1 |
| Subscriptions | AT-SUB-01..05 | P1 |
| Simulations | AT-SIM-01..05 | P1 |
| Learning | AT-LEARN-01..04 | P1 |
| NLP additions | AT-NLP-01..04 | P1 |
| Python service | AT-PY-01..05 | P2 |
| PDF | AT-PDF-01..04 | P2 |

## 6. Environment variables

Existing (see BACKEND_AUDIT section 10). New:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `INARI_FEATURES` | no | `csv,ledger` | Comma list: `csv,sms,pdf,llm,subs,sim,report` |
| `INARI_LEDGER_STORE` | no | `memory` | `memory` / `json` / `mysql` (mysql only if D1b built) |
| `INARI_IDENTITY_SECRET` | yes in production | none | Signs the anonymous-id cookie (can reuse `JWT_SECRET` if you prefer one secret) |
| `INARI_MAX_CSV_BYTES`, `INARI_MAX_ROWS` | no | 5 MB, 20 000 | Import limits |
| `INARI_STUB` | no | `false` | Return fixtures from `inari.*` (frontend dev mode) |
| `INARI_LLM_URL` | only with Python service | empty | Private URL of `services/inari-llm` |
| `INARI_LLM_SHARED_SECRET` | with the above | none | Header secret Node -> Python |
| `INARI_LLM_TIMEOUT_MS` | no | 2500 | Adapter timeout before fallback |
| `INARI_LLM_PROVIDER_KEY` (Python side) | with real model | none | Provider API key, lives only in the Python service |
| `WEALTHVERSE_DEMO_MODE` | yes | | Keep `true` for the judge demo; D2 makes it per-browser |
| `WEALTHVERSE_PERSISTENCE` | | `json` or `memory` | `json` does not survive Render free redeploys [A] |

## 7. Deployment risks and mitigations

| Risk | Mitigation |
|---|---|
| Render free spin-down/restart wipes in-memory ledger mid-demo | Say so; pre-warm before demo; ship a one-click "load sample statement" so a restart costs 10 s |
| Build fails because of new dependency + `--frozen-lockfile` | No new deps in P0/P1; any dep added with lockfile committed and a local `pnpm install --frozen-lockfile` + `pnpm build` check first |
| Python service down or slow | Adapter timeout + circuit breaker + deterministic fallback; Python is optional (`INARI_LLM_URL` empty = off) |
| Real statement data pasted into a public demo | Per-browser identity, "Delete my data" action, no raw file persistence, redaction before any external call, privacy notice in the UI |
| Secrets exposure | Rotate now; never commit `.project-config.json`; Python key only in the Python service |
| Breaking existing demo | Additive contracts; old tests must pass at every commit; separate Render service |
| Time overrun | Cut line in section 1; freeze at 22:15 |
| `pnpm build` never run in audit | Run it in Phase 0 on the branch to know the baseline [A] |

## 8. Definition of done (per feature)

1. Acceptance tests listed in section 5 exist and pass in CI-equivalent local run.
2. Characterisation + 69 legacy tests still pass; `tsc` clean.
3. Types exported from `shared/inari/contracts.ts` and fixtures updated.
4. Documented limits and a line in the final status report: VERIFIED vs ASSUMPTION.
5. No secret or personal data in logs, fixtures or commits.

## 9. First 60 minutes after approval (concrete)

1. (You) Answer D1, D2, D3, D6; rotate secrets; paste PS04 text; share samples if available.
2. Create branch `inari/ps04`; run `tsc`, `vitest`, `pnpm build`; record baseline.
3. Land contracts + fixtures + stub `inari` router; tell the frontend developer the import path `@shared/inari/contracts` and that `trpc.inari.*` is callable.
4. Land identity cookie + ledger repository + first CSV fixture test.

## 10. What I verified vs what remains assumption (summary)

Verified in this audit: repo state and branch, every router procedure, schema, seed and fallback data, persistence behaviour, auth/demo identity, engines' inputs, LLM integration, env variables, 69 passing tests, clean type-check, absence of import/dedupe/simulation/subscription/report/guardrail code, absence of CSV/PDF dependencies, deployment config.
Not verified: production build, Render behaviour, real MySQL/TiDB path, live LLM, anything about real bank/SMS/PDF formats, PS04 scoring criteria, frontend behaviour (client code was only grepped for API usage), the unrelated `atlas-agents` project, and the `wealthverse-frontend` fragment.
