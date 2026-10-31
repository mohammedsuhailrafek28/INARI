# Browser acceptance results

Production URL: http://127.0.0.1:4320

**30 passed, 0 failed**: 26 primary browser journeys/checks and four secondary persona/mobile checks.

| Check | Result |
|---|---|
| Landing explains product and enters the actual Import Center | PASS |
| Canonical CSV preview and explicit confirmation writes exactly 494 rows | PASS |
| Dashboard verifies all four canonical financial invariants and unknown balances | PASS |
| Dashboard chart labels and category values agree with backend data | PASS |
| Duplicate CSV re-import prevents any second posting | PASS |
| Correction updates six merchant rows and downstream dashboard, chart and report | PASS |
| Correction can be restored through the same UI without losing rows | PASS |
| Create and update a confirmed goal with a backend projection | PASS |
| Monthly report displays ledger-based September totals | PASS |
| Income-drop what-if shows expected ₹17,625.96 surplus and leaves ledger unchanged | PASS |
| Goal what-if displays backend completion dates and changes its dependent result | PASS |
| Subscription cancellation what-if uses actual recurring payments without cancelling them | PASS |
| EMI reality check renders server-computed ₹40,700 total and ₹700 extra cost | PASS |
| Advisor answers a ledger-grounded dining question and contextual follow-up | PASS |
| Reload preserves the demo identity and imported ledger | PASS |
| Digital PDF fixture uploads, previews, shows page evidence and commits | PASS |
| SMS .txt upload previews and commits using an isolated identity | PASS |
| SMS paste preview uses the actual parser and requires confirmation | PASS |
| Selective possible-duplicate review includes only the explicitly selected row | PASS |
| Manual cash preview, confirm, repeated confirmation prevention and undo | PASS |
| Browser reimbursement creation, two settlements, complete-month netting and undo | PASS |
| Refund claim creation and explicit matching-credit confirmation | PASS |
| Import undo removes only the confirmed batch after explicit confirmation | PASS |
| A separate browser identity cannot see the canonical ledger | PASS |
| Four viewport full-page captures; no document overflow across all required routes | PASS |
| No browser runtime exceptions in the main journey | PASS |
| Original fictional-persona onboarding and profile switching remain interactive | PASS |
| Mobile CSV preview and confirm are usable with explicit confirmation | PASS |
| Mobile what-if uses actual backend results and refreshed parameter state | PASS |
| Mobile advisor textarea accepts dictated-style text and submits a grounded answer | PASS |

All tests use synthetic fixtures. Financial mutations are exercised through visible browser controls; session-bound tRPC queries independently verify the results. Claims/manual/PDF/SMS/duplicate-review fixtures use isolated identities. No test browser cookie is committed.

Coverage: seven required routes at 1440x900, 1366x768, 768x1024 and390x844, with 28 full-page captures and no document overflow. Additional images record previews, confirmations, corrected totals, scenarios, EMI, advisor, refund/reimbursement settlements and mobile interaction.

The final footer wording clarifies “No specific securities recommendations” to distinguish the existing generic educational SIP guidance. That copy-only adjustment was followed by a production rebuild and four landing recaptures.
