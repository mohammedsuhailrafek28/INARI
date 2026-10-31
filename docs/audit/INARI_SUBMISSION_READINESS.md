# INARI submission readiness

## Consolidated summary

| Measure | Result |
|---|---|
| Commit audited | `0482fa5` on `feature/inari-demo-ui` (local only); parents `074b5fd`, `backend` 5e483ee published |
| Unit / integration tests | **430 passed / 0 failed** (28 files), `tsc` clean, `vite build` + server bundle OK (re-run in this audit) |
| HTTP acceptance checks (production build, independent expectations) | **141 checks: 129 PASS, 8 PARTIAL, 4 FAIL** |
| HTTP FAILs | C3c (double counting across PDF layouts, **High**), I12 (SIP question mis-answered, Medium), S5 (no rate limit, Medium), S11 (no security headers, Low) |
| Browser flows (`/inari`) | 5 PASS (import, typed advisor question, cash entry + confirm, what-if, EMI), 1 PARTIAL (report: default-month fix not re-verified), 3 not tested or not built (SMS/PDF upload/goals/claims/reconcile UI, Wispr Flow) |
| NLP out-of-sample score | **12/30 = 40%** (author-labelled, 30 new utterances; supported phrasings ≈ 100%) |
| SLM / transfer learning | **Not performed.** No dataset, script, checkpoint, evaluation or model in use |
| Critical security findings | 0 Blocker; 1 High financial-correctness (F-1); isolation and cookie-forgery tests held |
| Deployment readiness | Config exists on an ancestor commit; **never deployed**; memory storage; demo identity |
| Wispr Flow | **Not tested.** Only synthetic keystrokes were used |

## Competition checklist (what can actually be shown)

| # | Capability | Demonstrable today? | Through | Gap |
|---|---|---|---|---|
| 1 | Voice-first via actual Wispr dictation | **Unproven.** The input is a normal textarea (should work), but nobody has dictated into it | `/inari` | Do the manual sequence on the demo machine; the NLP then limits what can be said (see 2 below) |
| 2 | Indian CSV/SMS/PDF ingestion | CSV: **yes**. PDF: **partly** (upload code in page, backend verified over HTTP on synthetic layouts, not browser-tested). SMS: backend only | CSV/PDF in `/inari`; SMS via HTTP | No SMS paste box; real bank PDFs untested; double-count risk F-1 |
| 3 | Persistent financial context | **Partly.** Reload persists within a server run; restart loses data on the default memory store; JSON store persists but needs a persistent disk | `/inari` reload; HTTP restart test | Pick the storage story honestly |
| 4 | Learning from corrections | Backend **yes** (merchant rule applied on re-import, reversible); **no UI** | HTTP | New UI needed (a "correct category" control) |
| 5 | Recurring-expense understanding | Backend yes (6 detected, confirm/dismiss, cancel-simulation arithmetic exact); one false positive; **no UI** | HTTP / advisor answer text | UI or advisor-only demo |
| 6 | Explainable what-ifs | **Yes**, strongest area (exact vs hand arithmetic; deterministic; ledger unchanged) | `/inari` panel + advisor | Only 2 of 7 scenario types in the panel |
| 7 | Goals | Backend yes; advisor can answer about a goal; **no UI to create one** | HTTP | New UI |
| 8 | Monthly reports | **Yes** (six months match ground truth) | `/inari` | Confirm default-month fix in browser |
| 9 | Four novelty features | EMI: **yes in UI**. Manual entry: **yes in UI via advisor card**. Refund Watch and reimbursements: backend verified end-to-end over HTTP, **no UI**; advisor lists/proposes but needs real claims first | `/inari` for 2 of 4 | Claims UI; reimbursements do not change base totals |
| 10 | Evidence and guardrails | Yes in answers (amounts traceable, `guardrail.status`, "no language model used" badge, data-quality notes, PDF page/line evidence) | `/inari` | Evidence not shown as drill-down |

**Best demonstrated differentiator:** the *grounded, deterministic what-if/report pipeline with an audit trail* — numbers are reproducible against independent ground truth, hypotheticals never mutate the ledger, unknowns are shown as "not provided", and answers say that no language model was used. Second: the No-Cost EMI reality check (simple, exact, easy to explain).

**Weakest mandatory feature:** *voice-first natural-language understanding.* It is regex-based, ~40% accurate on unseen phrasing, English only, and has not been tried with real dictation. A live Wispr demo that wanders from the scripted phrasings will visibly fail (e.g. "I spent 2500 on groceries yesterday" answers with a September total).

## Safe demo script (reproducible, verified in this audit)

1. Fresh browser → `/inari` → "Load synthetic sample" → Confirm import (494 rows; ₹85,102 / ₹57,476.04 / ₹27,625.96 / 32.46%).
2. Dictate/type: "How much did I spend on dining last month?" → ₹3,377 vs ₹4,506.
3. "What if I cut dining by 30%?" then "make it 50%" (context).
4. "I spent ₹350 cash yesterday." → preview → Confirm.
5. What-if panel: income −10000 → surplus ₹17,625.96 unchanged ledger.
6. EMI panel: 40,000 / 6,700 / 6 / fee 500 → ₹700 more, "not really no cost".
7. Report panel (verify month default first).
Avoid: Hindi/Hinglish, number-word amounts, multi-intent sentences, statements without ₹, "Reduce my rent…" imperatives, SIP/return questions.

## Minimum work before freezing (ranked, no new features)

1. **Do the Wispr dictation test** on the demo machine (10 minutes) and record what actually happens.
2. **Fix or neutralise F-1:** at minimum make `/inari`'s confirm text show the number of rows that will actually be written (accepted + possible duplicates) and warn; ideally have commit skip `possible_duplicate` rows by default. (A code change — needs your approval; not done here.)
3. **Fix NLP-1/NLP-2** (route "I spent N on X" statements to manual entry; stop "earn … less" triggering the investment refusal) — or restrict the demo script to verified phrasings.
4. Re-verify the report default-month fix in the browser; rebuild.
5. Decide storage: memory (honest, loses data on restart/redeploy) vs JSON on a persistent disk.
6. Add a link/nav to `/inari`, fix the browser title, merge with the teammate's frontend (their work is unseen).
7. Deploy to Render with the four env vars and run the demo script against the live URL (never done).
8. Description wording: no "fine-tuned"/"SLM"/"production auth" claims.

## Verdict

INARI is a **credible, reproducible demonstration of a deterministic personal-finance engine** with strong correctness evidence behind its numbers. It is **not** yet a credible demonstration of a *voice-first, language-understanding* product, and the AI/SLM narrative must be limited to "rules and user feedback; SLM is future work". It is **deployable as a short-lived synthetic-data demo** once the Wispr test and the F-1 wording are handled, but it has not been deployed.
