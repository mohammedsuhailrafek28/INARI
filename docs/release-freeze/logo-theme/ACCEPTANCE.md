# Logo-theme acceptance (fresh production build, port 4340)

Source logo: `C:\Users\HAIL\Downloads\Inari_logo.jpeg` (unmodified; crops only).

Gates: vitest 493/493, `tsc --noEmit` exit 0, production build OK.

Playwright runs: 120 PASS in the raw output (`acceptance-raw-output.txt`). Nine lines in that raw output
read FAIL; each was re-checked against the app and is a test-script artifact, not an app defect:

| Raw FAIL | Cause | Re-verification |
|---|---|---|
| SMS failed/OTP reasons (3 lines) | regex looked for "fail"; UI says "Payment did not complete; nothing was booked." | reasons visible, OTP digits absent |
| report 2026-09 | text slice started at the nav link | Sept report: income ₹85,306, spend ₹50,449 |
| emi | search term matched no payment | EMI check passes elsewhere in the run (₹40,700 vs ₹40,000, ₹700 extra) |
| undo restores ledger | dialog not accepted in that script | PDF commit then undo restores 494 / exact totals |
| settlement / reimbursement netted | manual credit is dated today (Oct, partial month) and the claim search matched nothing | SMS credit dated 2026-09-14 settled against rent: Sept expenses 50,449.24 -> 48,449.24, income 87,306 -> 85,306, undo restores 57,476.04 |
| explicitly included 1 of 4 duplicates | first checkbox is "include all" | one row included: 516 rows, undo -> 494 |
| console 400 | intended rejection of an over-settled reimbursement | none |
