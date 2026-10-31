# INARI frontend handoff (Phase 2: CSV → ledger → snapshot)

Branch: `backend` (frontend works on `frontend`; both cut from the same baseline commit). Contract version `inari.v1`.
Source of truth: `shared/inari/contracts.ts`. Status per procedure: `trpc.inari.meta` → `procedures`.

## 1. Imports

```ts
import type { AppRouter } from "../../server/routers";
import { PROCEDURE_STATUS, CATEGORIES, type Snapshot, type LedgerTransaction, type ImportPreview } from "@shared/inari/contracts";
import * as fixtures from "@shared/inari/fixtures";   // synthetic data for procedures still marked "stub"
```
Call the API through the existing client: `trpc.inari.<procedure>.useQuery/useMutation`.

## 2. The rule that protects the demo

Every `inari.*` response has `implementation: "stub" | "implemented"`. **`stub` = synthetic fixture, not a calculation** – show a visible "sample data" badge. Drive it from `meta.procedures`, not hard-coded.

## 3. Procedures

| Procedure (aliases) | Kind | Status |
|---|---|---|
| `meta`, `getCategories`, `importHistory`, `listTransactions` (`getTransactions`), `clearMyData` | q / m | **implemented** |
| `importPreview` → `importCommit` → `importUndo` | m | **implemented** (CSV only; SMS/PDF return `NOT_IMPLEMENTED`) |
| `getSnapshot`, `setBalances`, `useDemoData` | q / m | **implemented** |
| `correctCategory`, `listLearnedRules` (`getLearnedRules`), `deleteLearnedRule`, `getBreakdown` | q / m | **implemented** |
| `simulate`, `analyzeIntent`, `listSubscriptions` (`getSubscriptions`), `confirmSubscription`, `monthlyReport` (`getMonthlyReport`), `listReportMonths`, `reconcile` | q / m | **implemented** (see their sections below) |
| `ask` / `askAdvisor` | m | **implemented**, deterministic (no LLM) |
| `getGoals`, `upsertGoal`, `deleteGoal` | | stub |

### Import flow
1. `importPreview({kind:"csv", filename, content})` – nothing is stored. Returns `previewId`, `counts` (`accepted/duplicate/possibleDuplicate/rejected/ignored`), `detectedFormat`, `period`, `warnings`, up to 200 `rows` (problems first; `rejected` rows carry a `reason`). Previews expire after 30 minutes and are private to the caller.
2. Show the preview; on confirm `importCommit({previewId, accountLabel?})` → `ImportBatch`. Re-importing the same file adds nothing (`duplicate`), overlapping files add only new rows. A file with nothing new fails with `NO_DATA`.
3. `importUndo({batchId})` removes the batch and its effect on every number.

Accepted CSV shapes: separate Debit/Credit columns, one signed `Amount`, `Amount`+`Dr/Cr`, amounts with `Dr`/`Cr` suffix, bank-statement preamble/footer lines, Indian digit grouping, `dd/mm/yyyy`, `dd-Mon-yyyy`, ISO dates. A positive-only amount column with no marker is **rejected, not guessed**. Money is parsed to integer paise.

## 4. Snapshot semantics (what each number means)

`getSnapshot()` → `Snapshot`.
- `dataSource`: `"imported"` once a statement is committed; `"demo"` means *no imported dataset is active* – all figures are `null`, never persona values.
- **A month counts only if the imported coverage reaches within 5 days of both its first and last day.** `monthlyIncome/Expenses/Surplus/savingsRate` average the latest ≤3 complete months. With no complete month they are `null` and `dataQuality` contains `no_complete_month`.
- Income = salary + other-income credits. Expenses = spending categories minus refunds. Investments, savings and transfers are neutral (they raise surplus). `savingsRate` is a percentage (40 = 40%).
- `balances.*` (emergency fund, investments, card debt) are **never inferred**. `null` until the user calls `setBalances`; `provenance.<field>` is `missing | user_input | observed | estimated`.
- `provenance.income` is `estimated` with one complete month, `observed` with two or more.
- `dataQuality[]` (`code`, `severity`, `message`, optional `transactionIds` ≤ 50): `no_complete_month`, `few_months`, `partial_months`, `gap_months`, `possible_duplicates`, `unclassified`, **reconciliation exceptions** `card_repayment_counted`, `possible_transfer_pair`, `refund_counted_as_income`, plus informational `transfers_excluded`, `refunds_netted`, `assumption_averaging`, `assumption_definitions`. Exceptions are **reported, never silently resolved**; the user resolves them with `correctCategory` (for example mark both rows of a pair as `transfer`). Use `transactionIds` with `listTransactions` to show the evidence rows.

## 5. Existing WealthVerse routes now follow imported data

Once the caller has committed a statement (and has not called `useDemoData({enabled:true})`), these use the ledger instead of the seeded persona: `dashboard.getSummary`, `spending.*`, `recommendations.list`, `alerts.list`, `transactions.recent/summary`, `goals.list` (empty – persona goals do not apply), `wealth.*` (context, insights, risk, predictions, advisor).

`dashboard.getSummary` in imported mode adds `dataSource:"imported"`, `dataAsOf`, `unknownFields`, `dataQuality` and **returns `null` for unknown values** (`financialHealth`, `investmentBalance`, `emergencyFundBalance`, `creditCardDebt`, and income/expenses/savingsRate while no month is complete). `financialHealth` can carry `partial:true` + `unknownComponents` – the score then covers only known components, rescaled to 100. The advisor says a balance is "not provided" instead of inventing one, and no balance-based recommendation is produced for unknown balances.
**Client changes made on `backend` (minimal, to keep `tsc` green):** `Dashboard.tsx` and `AvatarAdvisor.tsx` tolerate `null` (credit-card card shows "Not provided"; health score falls back to 0 when null). **The frontend still needs proper empty/"add your balances" states.**

## 6. Identity (demo only)
First request gets a signed `inari_demo_id` cookie (HttpOnly, SameSite=Lax, Secure on https, 30 days). All INARI data is scoped to it, so two browsers never see each other's data. This is demo isolation, not authentication. Clearing cookies orphans the data. Same-origin only (no CORS change). Offer a "Delete my data" button → `clearMyData({confirm:"DELETE"})`.

## 7. Errors
Every failed call carries `error.data.inari = { code, fields? }` where `code ∈ INARI_ERROR_CODES` (`INVALID_INPUT`, `PARSE_FAILED`, `PREVIEW_EXPIRED`, `NO_DATA`, `NOT_FOUND`, `NOT_IMPLEMENTED`, `INTERNAL`, …) and `fields` is `[{path, issue}]` for validation errors. Messages are safe to display; they never echo submitted values or stack traces. Branch on `code`, not on message text.

## 8. Categories and corrections
Taxonomy: 22 ids in `CATEGORIES`. Precedence: **user correction > learned merchant rule > deterministic rule > unclassified** (`categorySource`). `correctCategory({transactionId, category, applyToMerchant})`; with `applyToMerchant:true` it creates a learned rule, re-labels non-user siblings and applies to future imports. Deleting a rule reverts only rule-derived rows. This is rule + feedback learning, not model fine-tuning. Every correction recalculates the snapshot and the legacy routes.

## 9. Test data
`data/demo/` has a reproducible fictional profile (494 rows, 6 months) in three CSV layouts – upload any of them to see a populated app. Expected values: `data/demo/expected.json`. See `data/README.md`.

## 10. Setup
```bash
git checkout backend && pnpm install
cp .env.example .env     # demo mode on by default in development
pnpm dev                 # http://localhost:3000
pnpm test && pnpm run check && pnpm build
```
`INARI_LEDGER_STORE=json` persists the ledger to `.runtime/inari-data/ledger.json` (gitignored). `meta.storage.durable` is `false` on purpose: ephemeral hosts wipe local disk.

## 11. Known limitations
- CSV only. No SMS/PDF import, recurring-payment detection, simulations, monthly report or goals backend yet (stubs).
- Storage is in-memory/JSON (demo-grade). No real authentication.
- Voice: the backend receives dictated text only; no Wispr Flow integration assumed.
- Persona-only legacy features (savings streak, badges, stored alerts) are empty in imported mode.

## Simulation and dictated-text intent (implemented, backend branch)

`inari.analyzeIntent({text, previous?})` turns dictated text into a structured intent. It is rule-based and deterministic (no LLM). Fillers are removed, number words and `k`/`lakh`/`crore` are understood, and the **latest** amount wins when the speaker corrects themselves ("4000, actually make that 5000"). When something is missing it returns a clarification question instead of guessing; pass the earlier result back as `previous` to answer it.

`inari.simulate({scenarios})` is pure backend arithmetic in integer paise. It never changes the ledger (`ledgerUnchanged` is always `true`).

- Supported: `reduce_category`, `change_income`, `one_off_expense`, `start_sip`, `pay_down_debt`.
- `cancel_subscriptions` and `change_goal_contribution` return error code `INVALID_SCENARIO` ("not available yet") because subscriptions and goals are still stubs.
- Several scenarios can be combined. An identical repeated scenario is applied once (warning shown). Reductions to the same category add up and are capped at that category's spend.
- With no import, or no complete month, `status` is `"insufficient_data"` with empty `metrics`. Show the `warnings`.
- Each metric has `baseline`, `scenario` and `delta`. Show `assumptions` and `warnings` with every result.
- **New, optional field `evidence`** (same shape as `dataQuality` notes). It lists the baseline months and any unresolved flags the numbers inherit (card repayments counted as expenses, possible duplicates, possible transfer pairs). Older clients can ignore it.
- Unknown balances are never invented: emergency-fund cover is omitted and a warning explains why.

Snapshot change: the `possible_duplicates` note now carries `transactionIds` and says those rows are included in totals. Dashboard change: `ProfileHero` now receives `undefined` (shows "Review") instead of `0` when the health score is unknown.

## SMS import (implemented, backend branch)

`inari.importPreview({kind:"sms", text})` then `inari.importCommit` use the same flow as CSV. Paste any number of alerts separated by a blank line (or one per line). No contract change: `source` is `"sms"`, and the preview lists skipped messages as rows with `status: "ignored"` (OTPs, balance alerts, promotions, pending, failed, upcoming, card bills, card/wallet-side credits) or `"rejected"` (e.g. no date in the message). Reasons are fixed phrases and never quote the message.

- Completed debits and bank-account credits (salary, UPI, refunds, reversals) become ledger rows. Card-side and wallet-side credits are not booked.
- OTP content is never stored, returned or logged. The raw SMS body is never saved: a row keeps amount (paise), date, merchant, last-4, reference and a rebuilt narration (`SMS upi debit: SWIGGY (A/c ..1234) ref ...`).
- Balances quoted in SMS are not used; balances stay `null` until the user provides them.
- A message with the same date, amount and direction as an existing CSV row is imported and flagged `possible_duplicate` (counted in totals until the user undoes the SMS batch with `importUndo`). Nothing is deleted automatically.
- Not supported: messages without a date, regional-language SMS, exported-inbox formats with timestamps/senders, multi-transaction summary SMS, PDF.

## Recurring payments / subscriptions (implemented, backend branch)

`inari.listSubscriptions` (alias `getSubscriptions`) is derived from the ledger on every call (CSV and SMS rows alike); nothing is cached, so it always agrees with the transactions. `inari.confirmSubscription({subscriptionId, decision: "confirm"|"dismiss"})` stores only the user's decision.

- Detected: the same merchant, expense debits, a regular gap (weekly, monthly, quarterly, yearly) and a steady amount. Needs 3 charges (2 for yearly). Status starts as `"possible"`; `confidence` is 0-1.
- Not subscriptions: rent, EMI, transfers, investments, savings, cash, and variable bills (e.g. electricity with changing amounts).
- `flags`: `price_increase` (with `priceChange`), `inactive` (no longer charged; excluded from totals), `possible_duplicate` (two charges inside one cycle), `new`.
- `monthlyTotal` / `annualTotal` count active items only (not dismissed, not inactive). `typicalAmount` is the latest charge.
- Ids are stable (`sub_...`, derived from the merchant). An unknown id returns `NOT_FOUND`.
- `simulate` now supports `cancel_subscriptions` with these ids (unknown id -> `INVALID_SCENARIO`; dismissed/inactive -> warning, no saving). `change_goal_contribution` is still unavailable.
- Not detected yet: charges whose amount changes by more than 25%, merchants that vary in name between statements, and subscriptions seen only once.

## Monthly review, drift, guardrails, reconciliation (implemented, backend branch)

### `inari.monthlyReport({month})` (alias `getMonthlyReport`) and `inari.listReportMonths()`
Built only from the user's imported transactions (CSV and SMS). `listReportMonths` returns months that have data, newest first.

- `status: "insufficient_data"` (no data for that month, a future month, or demo/no import): `totals` are zeros and **must not be shown**; show `dataQuality[0].message`. Nothing is invented.
- **Existing fields, now real:** `totals`, `previousMonth` (null unless the earlier month is fully covered), `categories` (previous-month change nulled the same way), `topMerchants`, `unusualTransactionIds`, `subscriptions`, `actions` (max 3), `narrative` (`mode:"fallback"` = template text, no LLM), `dataQuality`.
- **New optional fields (backward compatible):**
  - `period {from,to,daysInMonth,daysElapsed,partial,reason}`: `partial` is true for the current calendar month or when the imports do not cover the whole month. Show `reason` as a banner. A partial month's headline says "so far".
  - `drift {status, baselineMonths, items[]}`: a category is flagged when this month is at least 25% **and** at least ₹500 above its average over up to 3 earlier complete months. Needs 2 such months; otherwise `status:"insufficient_history"` with an explanatory `dataQuality` note. In a partial month items are `provisional` and falls are not reported.
  - `obligations[]`: active subscriptions plus rent and EMI paid that month.
  - `unknowns[]`: things never provided, e.g. `goals`, `emergencyFund`, `investments`, `creditCardDebt`. Render them as "not provided", never as 0.
  - `guardrails {status, reasons}`.
- Every `actions[]` entry carries `evidenceTransactionIds` that exist in the user's ledger, and `expectedImpactInr` (a computed number, or null). A "Confirm flagged transactions" action appears whenever unresolved duplicate/card-repayment/transfer flags touch the month.
- Guardrails: all text is checked so that it contains no guaranteed-return/risk-free claims, no buy/sell/invest-in recommendations, no return projections, and no rupee amount or percentage that the backend did not compute. A failing text is replaced by a number-free fallback and `guardrails.status` becomes `"modified"` or `"refused"`.

### `inari.reconcile({transactionIds, decision})` (new procedure)
The explicit, user-confirmed way to resolve a flagged item. Rows are **never deleted**.

| decision | allowed on | effect |
|---|---|---|
| `exclude_duplicate` | rows flagged `possibleDuplicateOf` | row leaves all totals; original stays. Refused if the original is selected or already excluded |
| `exclude_card_double_count` | card-repayment debits | row leaves all totals |
| `keep_separate` | rows flagged `possibleDuplicateOf` | both rows stay counted; the warning is cleared |
| `undo` | any row with a decision | restores it |

`LedgerTransaction.reconciliation?: {decision, decidedAt}` is a new optional field. Excluded rows still appear in `listTransactions`; show them dimmed with a "Restore" button. The snapshot and report add an info note `reconciliation_applied` listing them, so exclusions are always visible. `coverage.transactionCount` counts only rows that are not excluded.

### Other behaviour changes
- Subscription detection is now limited to subscription-like categories (subscription, entertainment, insurance, education, health, fees, other). Steady groceries, transport, shopping and utilities are no longer reported as subscriptions.
- `possible_duplicates` / `card_repayment_counted` notes now point to `inari.reconcile`.

### Frontend requirements
Handle `status:"insufficient_data"`, `period.partial`, nullable `previousMonth`, `drift.status`, `unknowns`, and excluded rows (`reconciliation`). Never display `totals` when insufficient. Offer the reconcile actions only for flagged rows.

## Advisor: `inari.ask({question, locale, previous?})` (alias `askAdvisor`)

**It is not an LLM.** Every answer is built by deterministic code from the user's imported ledger, the snapshot, the report, the recurring detector and the simulation engine. `mode` is always `"fallback"` and `engine = {kind:"deterministic", llmUsed:false, model:null}`. Never label it "AI-powered" or "LLM"; use `engine` to drive any badge (`meta.features.llm` is `false`). If an LLM is added later, `engine.llmUsed` will be `true` only when a model actually ran.

The advisor **never changes data**. Anything consequential comes back in `proposedActions[]` (`requiresConfirmation: true`, with the `procedure` and a ready `input`). Show a confirm button; only when the user confirms, call that procedure yourself.

### Request
- `question` string, `locale` (`"en"`), `previous?` = the `context` object echoed from the last response (stateless follow-ups, e.g. "and in August?", "what about 40 percent instead?").

### Response (all new fields are optional, so older clients still work)
`answer`, `summary`, `keyInsights[]`, `suggestedNextActions[]`, `followUpQuestions[]`, `relatedMetrics[{label,value}]`, `confidenceLevel` (`low|medium|high`), `mode`, `engine`, `disclaimer`, `dataSource`, `dataAsOf`, `guardrail {status: passed|modified|refused, reasons[]}`, `intent` (parsed intent or null), `simulation` (the full `SimulationResult` for what-ifs, else null), `evidence[]` (data-quality notes with `transactionIds`), `assumptions[]`, `limitations[]`, `proposedActions[]`, `context`.

### What it answers
| Question type | Source | Notes |
|---|---|---|
| Spending by category / merchant / month, with follow-ups | ledger | month defaults to the latest complete month; says so |
| Savings, income, savings rate | snapshot | needs a complete month, otherwise low confidence |
| Recurring payments, one merchant, "should I cancel X" | recurring detector | cancel = what-if via `simulate` plus a `confirm_subscription` proposal; nothing is cancelled |
| What-if ("cut dining by 30%", "reduce X by 40 percent instead") | `simulate` | exact baseline/after/delta; incomplete scenarios get a clarifying question |
| Monthly review / "why did X go up" | monthly report and drift | admits when history is too short |
| Duplicates, flagged items, card repayments | reconciliation flags | proposes `reconcile` actions with real transaction ids |
| Emergency fund, investments, balances | snapshot | `null` stays "not provided"; proposes `set_balances` |
| Recategorise a transaction | none | proposal only (`correct_category`) |
| Import needed | none | no data: says so and proposes `import_data` |

### Not supported (the advisor says so rather than guessing)
Goals (backend stub), `change_goal_contribution` scenarios, market or general-knowledge questions, tax advice, specific investment picks, return projections or guarantees (refused, `guardrail.status:"refused"`), amount-only follow-ups, PDF-sourced data.

### UI states you must handle
1. **No data**: `confidenceLevel:"low"`, `proposedActions` contains `import_data`. Link to the import screen.
2. **Clarification**: `intent` incomplete, answer is a question, `context` carries what was understood. Send the user's reply with `previous = context`.
3. **Refusal**: `guardrail.status:"refused"`. Show the answer as-is plus the disclaimer.
4. **Low confidence / unknown topic**: show `limitations` and the capability list in `followUpQuestions`.
5. **Proposed actions**: render each as a card with a Confirm button; confirmed -> call `action.procedure` with `action.input`, then refresh snapshot/report.
6. **Evidence**: show `evidence[]` and `assumptions[]` in an expandable "How this was calculated" panel; link `transactionIds` to the ledger.
7. **Engine badge**: "Rule-based answer" from `engine.kind`, not a hard-coded "AI".

### Guardrails
Every text field passes the same check as the monthly report: no guaranteed/risk-free claims, no buy/sell/invest-in recommendations, no return projections, and no rupee amount or percentage that the backend did not compute. A failing text is replaced by a number-free fallback and `guardrail.status` becomes `modified` or `refused`.

## Reconciled rows across modules
Rows excluded via `inari.reconcile` are treated identically by the snapshot, `getBreakdown`, `simulate`, `monthlyReport`, `ask`, `listSubscriptions` and `dashboard.*`. They stay in `listTransactions` (with `reconciliation`). `undo` restores them everywhere; re-importing an excluded SMS is a plain duplicate and keeps the decision; undoing the import batch and re-importing re-flags it.

## Remaining stubs and gaps
- Stub (fixture data, show "sample"): `getGoals`, `upsertGoal`, `deleteGoal`.
- Not implemented: PDF import (`NOT_IMPLEMENTED`), LLM inference, goal-based scenarios.
- Storage is non-durable and identity is demo-grade (`meta.storage`, `meta.identity`).
