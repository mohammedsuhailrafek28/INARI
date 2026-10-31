# INARI security and financial-correctness audit

Synthetic data only. Tests run against the production build over HTTP (`docs/audit/INARI_FUNCTIONAL_ACCEPTANCE.md` has the IDs referenced here). Severity: Blocker / High / Medium / Low.

## Findings

| # | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| F-1 | **High** (financial correctness) | **Committing a preview that contains `possible_duplicate` rows imports them.** `commitImport` filters only `status === "duplicate"` (`server/inari/service.ts:198`); possible duplicates are written with a `possibleDuplicateOf` pointer and count in totals until the user reconciles. There is no way to exclude them at commit time (`importCommit` input is `previewId`, `accountLabel`). Re-importing the *same statement in another PDF layout* grew the ledger 24 → 32 → 56 transactions | C3c (FAIL). B5 shows the cross-source SMS-vs-CSV case is flagged `possible_duplicate`, but also imported on commit | Open. Mitigation exists (`reconcile` + snapshot `dataQuality` notes), but `/inari` has no reconcile UI and its confirm button says "Confirm import of N transactions" where N counts only *accepted* rows, understating what will be written |
| F-2 | Medium | No rate limiting on any route (400 concurrent calls: all 200) | S5 (FAIL) | Open. Acceptable for a short demo, not for a public service |
| F-3 | Medium | NLP mis-routing produces confident, wrong, grounded-looking answers ("I spent 2500 on groceries yesterday" → September grocery total) and a wrong refusal reason for a budgeting question | NLP-1, NLP-2 | Open |
| F-4 | Medium | Demo identity is a bearer cookie, not authentication; whoever holds `inari_demo_id` owns the data; default storage is memory | `identity.ts`; cookie `HttpOnly; SameSite=Lax; Max-Age=30d`, `Secure` only when HTTPS / `x-forwarded-proto: https` | By design; must not be described as production auth |
| F-5 | Medium | JSON store writes the complete ledger (narrations, amounts, goals, claims) as plaintext at `INARI_DATA_DIR/ledger.json`, no encryption | `fileLedgerRepository.ts`; observed 290 KB file | By design (demo-grade); keep off for real data |
| F-6 | Medium | Legacy WealthVerse routers (`profiles`, `dashboard`, `ai`, …) remain reachable (`profiles.list` → 200). Legacy `advisorEngine` can call an external chat model **if** `BUILT_IN_FORGE_API_KEY` is set; `render.yaml` sets none and `inari.noexternal.test.ts` asserts INARI routes never call it | S10; code | Keep the key unset in every environment that holds imported data |
| F-7 | Low | No security headers: no CSP, no `X-Content-Type-Options`, `X-Powered-By: Express` | S11 (FAIL) | Open |
| F-8 | Low | `confirmClaimMatch` error for a rejected double-allocation says only "The request was not valid. Check the highlighted fields." (K5) — correct behaviour, poor message | K5 | Open |
| F-9 | Low | Report-months list is newest-first; the harness initially defaulted to the oldest (April) | H1 / BR6 | Fixed in `0482fa5` source, **not re-verified in the browser** |
| F-10 | Low | A card repayment is detected as a "subscription" (HDFC ₹4,500) | F1 | Open |

No Blocker found. No cross-user data exposure found.

## Invariants tested

| Invariant | Result | Evidence |
|---|---|---|
| User isolation: B cannot read or mutate A | **Held** | L1–L3, E8 (reconcile with A's id → "not found"), S3 (B commits A's `previewId` → "expired or does not exist") |
| Cookie forgery | **Held** | S1 (valid format, wrong HMAC → fresh empty identity), S2 (A's signature with another uuid → empty), L4 (malformed cookie → empty) |
| Credit cannot settle more than its amount | **Held** | K5 (second claim cannot reuse a fully-allocated credit), K8 (4,500 credit applied to 800 outstanding → rejected) |
| Expected money is not cash | **Held** | K1: claim creation leaves snapshot and report totals identical |
| Hypotheticals do not mutate the ledger | **Held** | F5, J7 (snapshot and 494-row count identical after 6+ simulations), K19 (3 EMI checks add nothing), I7/I8 (what-ifs via advisor) |
| Undo restores state | **Held** | A5, E6, K6, K12 |
| Idempotent manual commit | **Held** | K11 (same key twice → one transaction, `duplicateSubmission:true`) |
| Corrections reversible without losing user choices | **Held** | D5, D6 |
| Excluded rows stay visible | **Held** | E2 (494 rows, 6 flagged) |
| Consistency across snapshot, report, simulation, advisor after reconciliation | **Held** | E1, E3, E4, E5 |
| No fabricated amounts without data | **Held** | I10, I11, J9 |
| Unknown balances are not invented | **Held** | J3–J6 warnings; snapshot balances null |
| No double counting on re-import of the *same* file | **Held** | A4/A4b |
| No double counting across formats/sources | **Not held** | F-1 |
| Integer paise | **Held** (source) | `money.ts`; ledger sums matched raw CSV to the paisa (A3b) |
| Goal arithmetic | **Held** | G1, G2, G3 vs hand arithmetic |

## Privacy and third parties

- **Logs.** The production server writes only start-up lines (`[OAuth] Initialized`, `Server started`); 0 of the seeded merchant names/amounts appeared in the log after the whole acceptance run. `server/inari` contains no `console.*`/`logger` calls.
- **SMS / OTP.** An OTP message is `ignored` with reason "its content is not stored"; the OTP digits appear neither in the preview response nor in the ledger. Account number is stored only as the last four digits in the narration ("A/c ..1234"). The stored narration for an accepted SMS is a derived summary ("SMS bank account debit: CHAI POINT"); I did not audit every code path for raw-text retention.
- **Third parties.** `grep` for `fetch(`/`axios`/URLs in `server/inari`: none. `inari.noexternal.test.ts` passes. The PDF library runs locally. The only outbound path in the repo is the legacy `invokeLLM`, disabled without a key.
- **Preview store.** Import previews live in process memory with a TTL (`gcPreviews`), keyed by user.

## Resource bounds

| Vector | Result |
|---|---|
| JSON body | 8 MB limit (`deploy/inari-demo`): 9 MB CSV → HTTP 413, server stayed healthy (S6, S6b) |
| CSV size/rows | `maxCsvBytes` 6 MB, `TOO_MANY_ROWS` error code exists; the cap value was not tested |
| PDF | 5 MB (6 MB rejected, C7), 60 pages (C4 too_many_pages), 150k text items, 20 s timeout, `isEvalSupported:false`, no XFA, password handling (C4/C5). No decompression-bomb or malformed-font fuzzing was done: **not tested** |
| `ask` input | 1000 chars (I9) |
| Injection | `=HYPERLINK(...)` and `<script>` narrations stored as inert text (S7); the React page escapes them. Not tested: CSV *export* (none exists) |

## Deployment configuration

- Required env vars: see technical audit §5. Missing demo-mode flags → every `inari.*` call is 401.
- `render.yaml` generates `JWT_SECRET`/`INARI_IDENTITY_SECRET`; no LLM key. `INARI_LEDGER_STORE=memory`. Never deployed in this audit.
- Single process, no clustering; two instances would not share memory-store data.

## Licence and attribution

- `pdfjs-dist` Apache-2.0 recorded in `NOTICE.md`.
- `data/parser-tests/sms/` is a third-party public SMS dataset carrying its own `LICENSE`, `ATTRIBUTION.md`, `CITATION.cff`; I did not re-verify its licence text here beyond its presence.
- FinEE and `DylanOrazi/Personal-Finance-Spending-Dashboard` are *not* included (`NOTICE.md:16`).
- **No repository `LICENSE` file** (deliberately withheld until ownership is resolved). Public repo without a licence = all rights reserved by default; judges/teammates may ask.
- The repo derives from "WealthVerse P0 Bot" commits; provenance of that baseline's content/licence is **not verified**.
- No AI co-author trailer in any commit message on the audited branch.

## Not tested

Real-world bank PDFs; browser-side XSS beyond escaping reasoning; HTTPS/proxy cookie behaviour on Render; concurrency/race on the JSON store; load beyond 400 requests; dependency vulnerability scan (`pnpm audit` not run).
