# Backend regression result

Command: `node node_modules/vitest/vitest.mjs run --reporter=dot`

- Test files: 30 passed, 1 failed (31 total).
- Tests: 460 passed, 1 failed (461 total).
- HTTP end-to-end, financial accounting, canonical fixtures, imports, PDF, SMS, duplicate handling, reconciliation, recurring payments, goals, scenarios, reports, advisor, no-external-service and original WealthVerse engine suites passed.
- Failure: `server/inari/inari.dataset.test.ts` — SMS corpus integrity / verbatim attributed upstream-file assertion.

Expected SHA256:
`7a2a912b94c135c366154076985a6b4139971c5be61869f552fad81bd5762360`

Observed SHA256:
`15ad367803331d0666ad6aac1846ec8355cf71689193d066447e33c26043e8dc`

The observed digest was independently computed from `git show f6115b6:data/parser-tests/sms/indian-payment-sms-dataset.json`, proving that the same mismatch is present in the requested release-candidate commit. No assertion, data, backend implementation or shared financial contract was modified in this integration. The file's attributed checksum discrepancy remains a release-gate limitation; it is not represented as a passing test.
