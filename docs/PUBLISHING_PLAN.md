# INARI: safe GitHub publishing and frontend iteration plan

Status: **plan only. Nothing has been pushed or deployed, and no remote is configured.** Every step marked (approval) needs an explicit yes from the project owner first.

## 1. Branches today
| Branch | Contents |
|---|---|
| `main` | Original baseline reference |
| `frontend` | Baseline 330e40b. Owned by the frontend teammate. **Do not edit.** |
| `backend` | All backend/AI/data work (tests, contract, docs) on top of the baseline |

`backend` also contains two small client edits made only to keep `tsc` green when the snapshot started returning `null` (`client/src/pages/Dashboard.tsx`, `client/src/pages/AvatarAdvisor.tsx`, 11 lines each way). These are the **only** shared-file overlap with the frontend branch.

## 2. Pre-publish checklist (all local, no network)
1. `git grep` for secret patterns across all branches (keys, connection strings, private keys). Last scan: clean.
2. Confirm `.project-config.json`, `.env*` are ignored and untracked (`.gitignore` covers them; `git ls-files | grep -i config` shows nothing sensitive).
3. The old project config contains credentials that must be **rotated by the owner**; they were never committed, so publication does not expose them. They were never read, copied or committed here.
4. Data review: only the synthetic generator and fixtures under `data/` are tracked; the downloaded SMS corpus is attributed and licensed in `data/parser-tests/sms/`. No real statements.
5. Run: `vitest run`, `tsc --noEmit`, `vite build`. All must be green on the exact commit being published.
6. Check `NOTICE.md` and dataset licences are included.

## 3. Publishing steps (approval)
1. Decision recorded: the destination `https://github.com/mohammedsuhailrafek28/INARI` stays **public** (Option B). It already exists and was empty when last checked; do not create another.
2. `git remote add origin <url>` (approval).
3. Push `main` and `frontend` unchanged, then `backend`. Never `--force`; never rewrite history.
4. Protect `main`: require PR review and passing checks. Add a CI job that runs the three checks above and a secret scanner.
5. Open the PR `backend` -> `main` (not into `frontend`).

## 4. Frontend iteration without touching the teammate's files
- The teammate keeps working on `frontend`. Backend never commits to it.
- Integration point is the contract only: `shared/inari/contracts.ts` (types and `PROCEDURE_STATUS`) and `docs/FRONTEND_HANDOFF.md`. Every change is additive and optional, so an older client keeps working.
- The teammate pulls backend work by `git merge backend` into a **throwaway integration branch** (`integration/ui-on-backend`), resolves the two overlapping client files by taking **their** version (the backend edits only add null tolerance; re-add it only if `tsc` complains), and runs the checks. Merge into `frontend` once green.
- Order of UI work, highest demo value first:
  1. Import screen (CSV + SMS paste) with preview and undo.
  2. Snapshot and spending breakdown from `getSnapshot` / `getBreakdown`, with "not provided" for null values.
  3. Ask screen on `inari.ask` with voice input/output on the client (speech-to-text in the browser; send text to `ask`; speak `answer`). Echo `context` as `previous`. Show the "Rule-based answer" badge from `engine`. Render `proposedActions` as confirm cards.
  4. What-if panel on `simulate` (including goal contributions).
  5. Monthly report and reconciliation (`reconcile`), subscriptions, goals.
- Handle every empty/low-confidence state listed in `docs/FRONTEND_HANDOFF.md` (no data, clarification, refusal, insufficient history).

## 5. Deployment gate (separate approval)
Blocked until: credentials rotated; durable storage chosen (current file/in-memory store is non-durable, `meta.storage.durable === false`); real authentication replaces the demo cookie identity (`meta.identity.productionGrade === false`); rate limiting on import/ask. A public demo may run the current build only as a clearly labelled, disposable, synthetic-data demo.
