# INARI integration-readiness audit

Audit date: 2026-10-31. Scope: backend branch `backend` after the goals milestone. **Nothing has been pushed or deployed, no remote exists, and the original WealthVerse repository was not touched.**

## 1. Repository facts (verified locally)
| Item | Result |
|---|---|
| Branches | `main` = `frontend` = 330e40b (a child of WealthVerse cd75ef1: its tree is cd75ef1 plus the INARI audit documents and `NOTICE.md`); `backend` = the same history plus 22 further INARI commits. Linear, no merges: 47 commits = the 24 original WealthVerse commits, then 23 INARI commits (the first is the baseline). |
| Remote | none configured |
| Tracked files | 341. Only `.env.example` matches an env/secret filename (placeholders only). `.project-config.json` is git-ignored and untracked. |
| Secret scan | Across the 20 most recent commits and the working tree: no key, token, connection-string or private-key patterns. No `.env`/config/key file was ever added in any branch's history. |
| Largest tracked file | 863 KB image. Total tracked size about 9 MB. |
| Data | Only the seeded synthetic generator output and fixtures under `data/`, plus an attributed, licensed public SMS test corpus in `data/parser-tests/sms/`. No real statements. |
| Commit identity | The 24 inherited WealthVerse commits keep their original author, `WealthVerse P0 Bot <wealthverse-p0@example.local>` (unchanged hashes). All 23 INARI commits are authored and committed by `Mohammed Suhail Rafek <255111071+mohammedsuhailrafek28@users.noreply.github.com>`. There are no AI co-author trailers. Pushing publishes these names and the GitHub noreply address, not a personal email. |
| `frontend` branch | Identical to `main` (the INARI baseline): it holds no teammate commits in this repository. The teammate's real work lives in their own clone or remote and must never be overwritten by this one. |

## 2. What must reach the frontend teammate
Integration is by contract, not by shared files. The teammate needs:
1. `shared/inari/contracts.ts` (types, Zod schemas, `PROCEDURE_STATUS`; all changes additive/optional) and `shared/inari/fixtures.ts`.
2. `docs/FRONTEND_HANDOFF.md` (per-procedure behaviour and UI states) and this file.
3. The backend commits, in order (all on `backend`):

| Commit | What it gives the UI |
|---|---|
| d8fa1a2, b9073ee, 7f517c3, ff8bfa5 | Contracts, signed per-browser identity, ledger, router, first handoff |
| 05390ab, 93d41cf, f5b8976 | CSV import, snapshot, categorisation/corrections, imported-mode dashboard/spending, HTTP e2e |
| 15b2cdd, 384b29a, 427e014, 8578019 | Synthetic data and fixtures, reconciliation notes in the snapshot, Phase 2 handoff |
| 925cb45 | `simulate`, `analyzeIntent` |
| be8c18c | SMS import (UPI/card/bank alerts) |
| 8ae0d56 | Recurring payments and `cancel_subscriptions` |
| e48b126 | `monthlyReport`, drift, guardrails, `reconcile` |
| cd41e79 | `ask` / `askAdvisor` (deterministic) |
| 19b22a7 | Goals, `change_goal_contribution`, proposal audit, publishing plan |
| (this milestone) | Test-timeout fix, no-external-LLM guard for imported data, this audit |

4. Shared-file overlap: `backend` edits `client/src/pages/Dashboard.tsx` and `AvatarAdvisor.tsx` (null tolerance only). On merge the teammate keeps **their** version and re-adds null handling only if `tsc` complains.

## 3. Frontend integration requirements (checklist)
All procedures return `implementation: "implemented"`; drive any "sample" badge from `inari.meta.procedures`. Call `trpc.inari.*`. Cookie identity is automatic (same origin, credentials included).

| Feature | Procedures | Must-have UI |
|---|---|---|
| CSV import | `importPreview({kind:"csv"})` -> `importCommit` -> `importUndo`, `importHistory` | Preview counts (accepted/duplicate/possibleDuplicate/rejected), warnings, undo |
| SMS import | `importPreview({kind:"sms", text})` | Paste box, per-message result, "OTP/promo ignored" count; raw SMS text is never stored |
| Snapshot | `getSnapshot`, `setBalances` | Render `null` as "Not provided"; `dataQuality` notes; balances only from user input |
| Spending | `getBreakdown`, `listTransactions`, `correctCategory` | Excluded rows dimmed with Restore |
| Reconciliation | `reconcile` | Confirm dialog per decision; undo; never auto-apply |
| Subscriptions | `listSubscriptions`, `confirmSubscription` | Flags (price increase, inactive, duplicate), confirm/dismiss |
| Report | `monthlyReport`, `listReportMonths` | `insufficient_data`, `period.partial`, drift status, unknowns, goals list |
| Simulation | `simulate` (7 scenario types) | Baseline vs scenario, assumptions, warnings, evidence; goals dates; never imply data changed |
| Advisor | `ask` / `askAdvisor` | "Rule-based answer" badge from `engine`; echo `context` as `previous`; confirm cards for `proposedActions`; `inputComplete:false` needs user input first |
| Goals | `getGoals`, `upsertGoal`, `deleteGoal` | Empty state (no sample goal), user-entered amounts only, `status`/`notes` |
| Errors | `error.data.inari.code` | Friendly message per code |

Suggested demo order: import CSV -> snapshot -> ask (voice) -> what-if -> add goal -> goal what-if -> paste SMS -> reconcile -> report.

## 4. Voice-first input requirements
The backend takes **text**. Voice is a client concern: dictation produces text, which goes to `inari.ask` (or `analyzeIntent`). The deterministic parser was built for dictated phrasing (spoken numbers such as "twenty percent", "rupees", Indian digit grouping, filler words) and is covered by tests on typed transcripts (spoken numbers, fillers like "um", "1.5 lakh", mid-sentence corrections).

Requirements for the Ask screen:
1. A plain, focusable `<textarea>` or `<input type="text">` (no custom contenteditable, no input masking) so system-wide dictation tools can type into it.
2. Do not strip, rewrite or autocorrect text on input; do not block paste; allow up to 1000 characters (`AskInput` limit).
3. Submit on Enter (Shift+Enter = newline) and with a visible button; keep focus in the field after the answer so the next dictation lands there.
4. Show the exact text that was sent, so the user can see what dictation produced; allow editing and resending.
5. Read answers aloud with the browser's `speechSynthesis` (optional), and always show the text.
6. Do **not** route audio through the template's `voiceTranscription` helper for this product: it uploads audio to an external service. Keep audio on the device (system dictation or the browser's built-in recognition).
7. Echo `context` as `previous` so spoken follow-ups ("and in August?", "what about 40 percent instead?") work.

### How to test Wispr Flow dictation
Wispr Flow is a system-wide dictation app that types the recognised text into whichever field has focus. It has no API for us to call, and **I have not run it** (it needs the user's machine and microphone), so this is a test protocol, not a result.
1. Run the app locally (`pnpm dev`) and open the Ask screen; click into the text field.
2. Hold the Wispr Flow hotkey and say each phrase below. Confirm the text appears in the field unchanged, press Enter, and compare with the expected answer.
3. Check: no characters dropped, "₹"/"rupees" handled, numbers as digits or words both work, punctuation does not break the parse, nothing is submitted automatically.

| Say | Expected |
|---|---|
| "How much did I spend on dining last month" | Category total for the latest complete month, with evidence |
| "And in August" (right after) | Same category for August 2026 |
| "What if I cut dining by thirty percent" | Exact before/after numbers, assumptions, nothing changed |
| "Which subscriptions am I paying for" | Subscription list |
| "Show my report for September" | September report summary |
| "How are my goals going" | Goals you entered, or "not added any savings goals" |
| "Which stock should I buy" | Refusal, `guardrail.status: "refused"` |
Record per phrase: dictated text, answer, pass/fail. Any mismatch caused by dictation (not by the parser) is a client input issue, not a backend one.

## 5. Blockers to a safe, isolated demonstration deployment
Status key: **FIXED** (done in this milestone), **BLOCKING** (must be resolved before any public URL), **ADVISORY** (acceptable for a short private demo).

| # | Item | Status |
|---|---|---|
| B1 | Legacy WealthVerse advisor routes could send the user's transactions to an external LLM if `BUILT_IN_FORGE_API_KEY` is set | **FIXED**: the LLM is skipped once imported data is active; regression test added. Still, leave `BUILT_IN_FORGE_API_KEY` unset on a demo deployment. |
| B2 | Intermittent whole-file test failure | **FIXED**: cause was the HTTP e2e `beforeAll` exceeding the default 10 s hook timeout on a cold cache (reproduced with a 1.5 s limit); timeouts raised in `vitest.config.ts`. Could not reproduce in 12 warm runs. |
| B3 | Credentials in the original project config must be rotated by the owner | **BLOCKING** (owner action; never read or used here) |
| B4 | Storage is in-memory/JSON on an ephemeral disk: data is lost on restart (`meta.storage.durable:false`) | ADVISORY for a demo; BLOCKING for real users |
| B5 | Identity is an anonymous signed cookie (`meta.identity.productionGrade:false`); no accounts | ADVISORY for a synthetic-data demo; BLOCKING for real users |
| B6 | `render.yaml` is still named `wealthverse`, free plan; it needs its own `INARI_IDENTITY_SECRET` (random, 32+ bytes) and `WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION` is `true` | **BLOCKING** until reviewed by the owner |
| B7 | No rate limiting, no `helmet`/security headers, JSON body limit is 50 MB while the CSV limit is 5 MB; memory per user is unbounded | **BLOCKING** for a public URL (add rate limit, lower body limit to about 8 MB, cap users or data per user) |
| B8 | Deployment must use only synthetic or the owner's own data; no real third-party statements | Policy |
| B9 | Cookie is `Secure` only over https; deploy behind https only | Config |
| B10 | Advisor is rule-based; no PDF import | Product gap, not a safety issue |

Recommended first deployment: private (password-protected or unlisted) Render service, synthetic data only, `WEALTHVERSE_PERSISTENCE=memory`, after B3, B6 and B7.

## 6. Exact Git commands and approval points
Nothing below has been run. Placeholders in `<>`.

**A0 (no approval, local only) - verify**
```bash
git status --short && git branch -vv && git log --oneline main..backend | wc -l
pnpm test && pnpm check && pnpm build
```

**D2 - decision before the first push:** commits carry a personal email. If you want a noreply address on future commits: `git config user.email "<id>+<user>@users.noreply.github.com"`. Existing commits keep the old address unless you rewrite history (not recommended; it needs your explicit approval and we would never force-push a shared branch).

**A1 (approval) - add the remote.** The destination repository already exists, is public and was empty when verified. Do not create another.
```bash
git remote -v                       # must print nothing (or show only the INARI URL). Never overwrite an existing origin.
git remote add origin https://github.com/mohammedsuhailrafek28/INARI.git
git ls-remote origin                # must print nothing
```
If `ls-remote` lists any branch, stop, fetch it and compare before pushing anything.

**A2 (approval) - publish the baseline, then backend. Never use `--force` or `--force-with-lease`.**
```bash
git push origin main
git push origin frontend      # skip if the teammate already pushed a frontend branch
git push -u origin backend
```
A plain push is refused by Git if it would overwrite remote history, which is the protection we rely on.

**A3 (approval) - draft pull request, not a merge**
```bash
gh pr create --draft --base main --head backend --title "INARI backend: ingestion, simulation, advisor, goals" --body-file docs/INTEGRATION_READINESS.md
```
Do not merge until a reviewer other than the author has approved. Protect `main` (require review and passing checks) in the repository settings.

**A4 (approval) - teammate integration, on their machine, in a throwaway branch**

INARI's history now starts with the 24 original WealthVerse commits (ending at cd75ef1) and the INARI baseline `330e40b` is their direct child, so any teammate branch that started from cd75ef1 shares ancestry with INARI and can be merged normally. **Confirm the teammate's starting commit first** (`git merge-base <their-branch> cd75ef1` should print cd75ef1).
```bash
# in the teammate's existing clone; their UI branch is called ui-work here and is never modified
git remote add inari https://github.com/mohammedsuhailrafek28/INARI.git
git fetch inari
git switch -c integration/ui-on-backend ui-work
git merge inari/backend
# conflicts are expected only where both sides changed a file:
#   client/src/pages/Dashboard.tsx, client/src/pages/AvatarAdvisor.tsx  -> keep the teammate's version
#   shared/inari/*, server/inari/*                                       -> keep the backend's version
pnpm install && pnpm check && pnpm test && pnpm build
git push -u inari integration/ui-on-backend
```
Then open a pull request `integration/ui-on-backend` -> `main` for review. If their branch did not start from cd75ef1, use this fallback instead of the merge: `git diff <their-base> ui-work -- client > ../ui.patch`, create `integration/ui-on-backend` from `inari/backend`, and `git apply --3way ../ui.patch`. Their original branch stays untouched either way.

**A5 (separate approval) - deployment.** Not prepared beyond section 5. Requires B3, B6, B7 and your go-ahead.

## 7. Planned, not started
The four approved novelty features remain planned and were not implemented in this milestone.

## 8. Final verification record (2026-10-31, before the first push)
| Check | Result |
|---|---|
| Local path / branch / HEAD | `<local INARI folder>`; values below are for the rewritten history, prepared locally before the first push |
| Branch pointers | `main` = `frontend` = 330e40b; `backend` = the final commit of this branch, 22 commits ahead of `main` |
| Graph | 47 commits in total, 1 root (22d2db6, the first WealthVerse commit), 0 merges, 0 tags, linear |
| Remote configured | none. `.git/config` has no WealthVerse reference |
| Destination | `mohammedsuhailrafek28/INARI`: exists, **public**, not archived, size 0, no branches, no commits, no pull requests |
| Write access | push and admin permissions for the signed-in account `mohammedsuhailrafek28` |
| Teammate commits on destination | none (repository is empty) |
| Pending invitation | one, to `swtzzz` with write access, created by the owner account at 2026-10-31 10:32 UTC. It was not created by this tooling and was not touched. |
| `wealth-verse` repository | untouched; its `main` is still cd75ef1; collaborators there: `mohammedsuhailrafek28`, `vasunthra-07` |

## 9. Public-repository safety audit
| Area | Result |
|---|---|
| Secrets in all 20 commits | None: no API-key, token, private-key or JWT patterns; no connection string with credentials except the placeholder `user:password@localhost` in `.env.example` |
| `.env`/config/key/db/archive files ever tracked | Only `.env.example` (placeholders). `.project-config.json` is ignored and was never committed |
| Test constants that look like secrets | Four obvious fakes in tests (for example `test-key-not-real`) |
| Large/unnecessary artifacts | None over 1 MB; repository about 7.4 MB |
| Hard-coded dev endpoints in source | None in server, shared or client source |
| Real personal/financial data | None found. No PAN-shaped or Aadhaar-shaped strings; the SMS corpus has 0 phone numbers and 0 e-mail addresses |
| Phone-shaped UPI IDs in the synthetic statement (F1) | **RESOLVED.** The generator now emits `demoqr<digits>@paytm`. It makes the same random draws, so every amount, date, category and count is unchanged (verified: all fixtures are identical to the previous ones apart from that token). `data/demo` and its checksums were regenerated; `inari.dataset.test.ts` now fails if any standalone 10-digit mobile-shaped or Aadhaar-shaped value reappears. |
| Licence file (F2) | **PENDING OWNER INPUT.** `package.json` says `MIT` but there is no `LICENSE` file. The text is ready (`make_license.py`, outside the repository) and needs two inputs from the owner: the copyright holder name and the year. `NOTICE.md` now states the intended scope (code and docs; not the CC BY 4.0 corpus, dependencies, or media/template files of unverified provenance) and that the licence file is pending. Nothing was invented. |
| Third-party data | SMS corpus is CC BY 4.0 with `LICENSE`, `CITATION.cff`, `ATTRIBUTION.md` and a recorded SHA-256, unmodified: suitable for public redistribution with attribution. Other candidate datasets are explicitly not included (`NOTICE.md`). |
| Reused code | `NOTICE.md` records the WealthVerse origin (cd75ef1) |
| Commit authorship | 24 inherited commits by `WealthVerse P0 Bot <wealthverse-p0@example.local>`; 23 INARI commits by `Mohammed Suhail Rafek` using the GitHub noreply address. Pushing to a public repository makes these names visible. |
| Configuration | `render.yaml` is public; it contains no secrets but sets `WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION=true`. Do not deploy from it until B6 and B7 are done. |

## 10. UI module inventory (from the client files in THIS repository)
This is the baseline WealthVerse client plus two null-tolerance edits. **The teammate's current UI is not in this repository and was not inspected.** There are zero `trpc.inari.*` calls anywhere in `client/src`.

| Need | What exists here | What is missing |
|---|---|---|
| Import (CSV/SMS), preview, undo | nothing (no file input, no paste box) | whole screen |
| Snapshot / "not provided" states | `Dashboard.tsx` reads legacy `dashboard.getSummary`, tolerates null | optionally move to `inari.getSnapshot`; data-quality notes UI |
| Spending / category correction | `SpendingInsights.tsx` on legacy `spending.*` (follows imported data on the server) | correction UI, excluded-row styling |
| Reconciliation | nothing | confirm dialog + undo |
| Subscriptions | nothing | list + confirm/dismiss |
| Monthly report, drift | nothing | report screen |
| Advisor | `AvatarAdvisor.tsx` on legacy `wealth.askAdvisor`; a `<textarea>` exists; browser speech synthesis exists (`VoiceControls`), text states that voice input is not available | switch to `inari.ask`, `context` echo, engine badge, proposed-action cards, refusal/clarification states, mic/dictation affordances |
| Scenarios | nothing | what-if panel on `inari.simulate` |
| Savings goals | `GoalPlanner.tsx` on legacy `goals.list`, which returns `[]` in imported mode | rewire to `inari.getGoals/upsertGoal/deleteGoal` |
| Voice input (Wispr Flow) | none needed beyond a plain focusable text field; the existing textarea is a candidate | verify behaviour per section 4 |
| Onboarding | persona selection and "building context" pages (demo personas) | route to import instead of persona when using own data |

Router in `App.tsx` is a plain path switch, so a new screen needs a route line plus a page file.

## 11. Teammate integration risks
1. Shared ancestry with WealthVerse cd75ef1 makes a normal merge possible (A4), but only if the teammate's branch started there; a patch fallback is documented.
2. Most backend capability has no UI yet, so the integration is mostly new screens, not conflicts.
3. Legacy routes and `inari.*` can disagree in wording; prefer `inari.*` for new work.
4. A teammate who edits `shared/inari/*` locally will drift from the contract; changes should be requested from the backend owner.
5. Test timeouts (fixed) and Windows line-ending warnings (`.gitattributes` pins fixtures only) may show noise in diffs.

## 12. Pre-push recheck and partial-failure recovery
Immediately before pushing, repeat (read-only) and stop if anything differs from section 8:
```bash
git status --short && git branch -vv && git remote -v
git ls-remote https://github.com/mohammedsuhailrafek28/INARI        # must print nothing
gh api repos/mohammedsuhailrafek28/INARI --jq '{visibility,size,push:.permissions.push}'
```
Push one branch at a time and verify after each (`git ls-remote origin`). Never `--force`, `--force-with-lease`, `--all` or `--mirror`.

| Situation | What it means | Recovery (nothing is deleted automatically) |
|---|---|---|
| `main` pushed, `frontend` or `backend` failed | Remote has a partial but valid history | Fix the cause (network, auth), re-run only the failed push. Pushes are idempotent. |
| Push rejected as non-fast-forward | Someone pushed to that branch first | Stop. `git fetch origin`, inspect with `git log origin/<branch>`, decide with the owner. Do not force. |
| Wrong content pushed | A mistake in what was published | Do not rewrite or delete remote branches without explicit approval. If a secret was pushed: rotate it first, then decide on cleanup. |
| Remote `main` is the default branch and was pushed first | Expected | Nothing to undo |
