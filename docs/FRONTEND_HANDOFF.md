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
| `listSubscriptions`, `confirmSubscription`, `simulate`, `ask`/`askAdvisor`, `analyzeIntent`, `monthlyReport`/`getMonthlyReport`, `listReportMonths`, `getGoals`, `upsertGoal`, `deleteGoal` | | stub |

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
