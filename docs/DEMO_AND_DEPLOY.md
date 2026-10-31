# INARI: demo script and deployment (synthetic data only)

All numbers below were produced by the running server (production build, real HTTP) and checked against figures the
data generator wrote independently (`data/demo/expected.json`, `data/demo/labels.csv`). Everything is fictional.

## 1. Deployment (single service)

The API and the built frontend must be served from **one origin**: the demo identity is an `HttpOnly`, `SameSite=Lax`
cookie. A frontend on a different domain will not receive it and every call will look like a new user.

| Variable | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | set by `render.yaml` |
| `JWT_SECRET` | long random value | required in production; also signs the demo cookie unless the next one is set |
| `INARI_IDENTITY_SECRET` | long random value | signs the anonymous demo cookie |
| `WEALTHVERSE_DEMO_MODE` | `true` | synthetic-data mode |
| `WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION` | `true` | otherwise production refuses to start in demo mode |
| `WEALTHVERSE_PERSISTENCE` | `memory` | no database needed |
| `INARI_LEDGER_STORE` | `memory` | imported data is lost on restart (by design for the demo) |
| `BUILT_IN_FORGE_API_KEY` | **leave unset** | keeps every external LLM off; imported data is never sent anywhere |
| `DATABASE_URL`, OAuth variables | unset | not used in the demo |

`render.yaml` already sets all of this and uses `generateValue: true` for both secrets, so no secret is committed.

```bash
# local production check
pnpm install --frozen-lockfile && pnpm build
JWT_SECRET=$(openssl rand -hex 32) INARI_IDENTITY_SECRET=$(openssl rand -hex 32) \
WEALTHVERSE_DEMO_MODE=true WEALTHVERSE_ALLOW_DEMO_IN_PRODUCTION=true PORT=3000 pnpm start
curl localhost:3000/api/health      # {"ok":true,"service":"inari","mode":"demo"}
```

Limits: request bodies 8 MB, CSV 5 MB / 20,000 rows, SMS 500,000 characters. Free-tier hosts sleep, so open the app once before recording.

Honest caveats to state if asked: the demo identity isolates browsers but is **not** production authentication; storage is
in memory; the server cannot tell real statements from synthetic ones, so the UI must say "synthetic demo data only"
next to the upload control.

## 2. Demo journey (about 3 minutes)

Use `data/demo/fixture_debit_credit.csv` (494 rows, 01 Apr to 28 Sep 2026). Start from a fresh browser (new cookie).

| # | Action | Expected on screen |
|---|---|---|
| 1 | Open INARI | no figures yet (`dataSource: demo`, income/expenses unknown) |
| 2 | Upload the CSV, review the preview, confirm | 494 rows accepted, 0 duplicates, 0 rejected; period 2026-04-01 to 2026-09-28 |
| 3 | Dashboard | income **₹85,102**, expenses **₹57,476.04**, surplus **₹27,625.96**, savings rate **32.46%** (3-month averages) |
| 4 | Ask: "How much did I spend on dining last month?" | "In September 2026 you spent ₹3,377 on dining & delivery. That is ₹1,130 less than August 2026 (₹4,506)." |
| 5 | Correct a category: open "CREDIT CARD PAYMENT HDFC BANK CARD XX4821" (₹4,500, shown as *other*), change it to **transfer**, apply to all from this merchant | 6 transactions updated |
| 6 | Dashboard again | expenses **₹52,976.04**, surplus **₹32,125.96**, savings rate **37.75%** (a card repayment is not spending) |
| 7 | Ask: "What is my savings rate?" | "...you earn about ₹85,102 and spend about ₹52,976 a month. That leaves ₹32,126 (37.8% of income)." |
| 8 | Ask: "What if my income drops by 10000 per month?" | surplus ₹32,126 to ₹22,126; savings rate 37.8% to 29.5%; 12-month cash ₹3,85,512 to ₹2,65,512 |
| 9 | Monthly report, September 2026 | income **₹85,306**, expenses **₹45,949.24**, savings rate **46.14%**; fuel flagged ₹2,978 vs usual ₹2,260 |

Optional extras (also verified): "What if I cut dining spending by 20 percent?" (spending ₹52,976 to ₹52,145, ₹831 lower);
"Which subscriptions do I have?" (5 recurring payments, about ₹2,472 a month).

Cross-checks: before step 5 the September report shows income 85,306 and expenses 50,449.24, which equal `expected.json`;
after step 5 the snapshot equals `snapshot_if_cc_repayment_excluded` (52,976.04 / 32,125.96 / 37.75). Dining ₹3,376.57 (Sep)
and ₹4,506.19 (Aug) equal the sums of `labels.csv`. Every answer reports `mode: "fallback"` and `engine.llmUsed: false`.

## 3. Voice

There is no voice code on the backend. Voice input is the frontend's text field filled by Wispr Flow dictation; the same
phrases above go through `inari.ask`. Test dictation of the phrases in step 4, 7 and 8 before recording.
