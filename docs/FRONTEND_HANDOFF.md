# INARI frontend handoff (Phase 1)

Branch: `backend` (frontend works on `frontend`; both cut from the same baseline commit). Contract version `inari.v1`.

## 1. Imports

```ts
import type { AppRouter } from "../../server/routers";           // existing tRPC types
import {
  PROCEDURE_STATUS, CATEGORIES, type Snapshot, type LedgerTransaction, type SimulationResult,
  type IntentAnalysis, type MonthlyReport, type Subscription, type InariAdvisorResponse, type ImportPreview,
} from "@shared/inari/contracts";
import * as fixtures from "@shared/inari/fixtures";               // synthetic data for offline UI work
```
`@shared` alias already exists in `vite.config.ts` / `tsconfig.json`. Call the API through the existing client: `trpc.inari.<procedure>.useQuery/useMutation`.

## 2. Rule that protects the demo

Every `inari.*` response has `implementation: "stub" | "implemented"`.
**`stub` = synthetic fixture, not a calculation.** Show a visible "sample data" badge while `implementation === "stub"` so the stub can never be mistaken for the user's real numbers. `trpc.inari.meta` returns the live status of all procedures (`meta.procedures`), so the badge logic can be driven by data, not hard-coded.

## 3. Procedures (status at the time of this handoff)

| Procedure (aliases) | Kind | Input -> Output | Status |
|---|---|---|---|
| `meta` | query | - -> `MetaOutput` (data source, identity kind, storage durability, limits, feature flags, procedure statuses) | **implemented** |
| `getCategories` | query | - -> `{items:[{id,label,kind}]}` | **implemented** |
| `importHistory` | query | - -> `{items: ImportBatchRecord[]}` | **implemented** (empty until import lands) |
| `listTransactions` (`getTransactions`) | query | `{month?,category?,q?,needsReview?,cursor?,limit?}` -> `{items,nextCursor,dataSource}` | **implemented** (empty until import lands) |
| `clearMyData` | mutation | `{confirm:"DELETE"}` -> counts removed | **implemented** |
| `getSnapshot`, `setBalances`, `useDemoData` | q / m | see contracts | stub |
| `importPreview`, `importCommit`, `importUndo` | m | `ImportSourceInput` / `{previewId}` / `{batchId}` | stub |
| `correctCategory`, `listLearnedRules` (`getLearnedRules`), `deleteLearnedRule`, `getBreakdown` | q / m | see contracts | stub |
| `listSubscriptions` (`getSubscriptions`), `confirmSubscription` | q / m | | stub |
| `simulate` | m | `{scenarios: Scenario[]}` (1-5 combined scenarios) -> `SimulationResult` | stub |
| `ask` (`askAdvisor`), `analyzeIntent` | m | `{question}` / `{text, previous?}` | stub |
| `monthlyReport` (`getMonthlyReport`), `listReportMonths` | q | `{month}` | stub |
| `getGoals`, `upsertGoal`, `deleteGoal` | q / m | | stub |

Aliases are the same procedure under two names (the proposal's name is canonical).

## 4. Differences from `APA_CONTRACT_PROPOSAL.md` (intentional)

1. Every output carries `implementation`. List outputs are objects (`{items: [...]}`) instead of bare arrays so the marker fits.
2. `simulate` takes `{scenarios: Scenario[]}` (not one scenario) to support "cancel two subscriptions *and* cut food by 30%".
3. `Snapshot` money fields are `number | null`: **`null` means unknown, never a persona number.**
4. Added `analyzeIntent`, `getCategories`, `confirmSubscription`, `getGoals` and `Subscription.status` (`confirmed|possible|dismissed`).
5. `IntentAnalysis` exposes spoken self-corrections (`amountsMentioned`, `corrections`, final `amount`) plus `needsClarification` / `requiresConfirmation`.

## 5. Identity (demo only)

The first request from a browser receives a signed `inari_demo_id` cookie (HttpOnly, SameSite=Lax, Secure on https). All INARI data is scoped to it, so two browsers never see each other's data. **This is demo isolation, not authentication.** Consequences for the UI:
- Clearing cookies orphans the user's data; there is no recovery.
- Frontend and API must be same-origin (as today). Cross-origin fetches need `credentials: "include"` and a CORS change that has **not** been made.
- Offer a "Delete my data" button wired to `clearMyData({confirm:"DELETE"})`.

## 6. Errors

tRPC errors keep the standard shape. Invalid input -> `BAD_REQUEST` with Zod issues in `error.message` (JSON string). Domain error codes (`INARI_ERROR_CODES`: `FILE_TOO_LARGE`, `PARSE_FAILED`, ...) will be attached under `error.data.inari` when the corresponding procedures are implemented; **no procedure emits them yet**. Handle unknown errors generically.

## 7. Setup

```bash
git checkout backend && pnpm install
cp .env.example .env              # demo mode on by default in development
pnpm dev                          # http://localhost:3000
pnpm test && pnpm run check
```
Optional: `INARI_LEDGER_STORE=json` persists the ledger to `.runtime/inari-data/ledger.json` (gitignored). Storage is reported as `durable:false` in `meta` on purpose: ephemeral hosts wipe local disk.

## 8. Known limitations right now
- No import path exists yet; `listTransactions` is always empty and `meta.dataSource` is `"demo"`.
- Existing WealthVerse routes (`dashboard.*`, `wealth.*`, ...) still return synthetic persona numbers until Phase 3 makes imported data authoritative. Do not present them as "your data".
- Voice: backend receives dictated text only (`analyzeIntent`, `ask`); `analyzeIntent` is a stub until Phase 4. No Wispr Flow SDK is assumed.
