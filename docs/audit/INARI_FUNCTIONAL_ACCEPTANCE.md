# INARI functional acceptance (HTTP against the production build)

**Build under test:** `dist/index.js` built from commit `0482fa5` (branch `feature/inari-demo-ui`), run as one Express process with `NODE_ENV=production`, demo mode on, in-memory store, synthetic data only. Date of the server clock: 2026-10-31.

**Method:** a Node script (kept outside the repo) drives the real tRPC HTTP endpoints with a cookie jar, so identity, cookies, serialisation and validation are the production ones. Expected values come from the generator's ground truth (`data/demo/expected.json`, `labels.csv`, `data/parser-tests/pdf/expected.json`) or from arithmetic done in the script, not from the API's own output. Unit tests are *not* counted here.

**Totals:** 141 checks: **129 PASS**, **8 PARTIAL**, **4 FAIL**. Two first-run FAILs (A3c, G1) were bugs in the audit script and are recorded as PASS with the explanation in the evidence column.

## Matrix

| ID | Area | Input / precondition | Expected | Actual | Result | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| A1 | CSV preview | 494-row synthetic CSV | 494 accepted, 0 rejected, nothing written | {"total":494,"accepted":494,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":0} | **PASS** |  | importPreview |
| A1b | CSV preview no mutation | snapshot after preview only | 0 transactions | 0 | **PASS** |  | getSnapshot |
| A2 | CSV commit | commit preview | committed, 494 accepted | {"total":494,"accepted":494,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":0} | **PASS** |  | importCommit |
| A3 | Snapshot exact totals | after commit | income 85102, exp 57476.04, surplus 27625.96, rate 32.46 | {"i":85102,"e":57476.04,"s":27625.96,"r":32.46} | **PASS** |  | generator ground truth expected.json |
| A3b | Ledger sums vs raw CSV | sum of all debits/credits | debit 391354.65 credit 511901.00 | {"sumD":391354.65,"sumC":511901,"n":494} | **PASS** |  | independent CSV parser in audit script |
| A3c | Independent income average | mean Jul-Sep credits from raw CSV | 85535.00 | 85102.00 (mean of 85000, 85000, 85306 computed from raw CSV) | **PASS** |  | own computation (earlier FAIL was an audit-script type bug, not an app defect); first run FAILED because of an audit-script type bug (string vs number); recomputed by hand: matches |
| A4 | Duplicate import | same CSV again | 494 duplicates, 0 accepted | {"total":494,"accepted":0,"duplicate":494,"possibleDuplicate":0,"rejected":0,"ignored":0} | **PASS** |  | importPreview |
| A4b | Duplicate commit does not double count | commit all-duplicate preview | still 494 tx | {"n2":494,"cm2":"Nothing new to import: every row was already imported or invalid."} | **PASS** |  | getSnapshot |
| A5 | Undo import | undo batch | 0 transactions, income null | {"st":"undone","n":0,"inc":null} | **PASS** |  | importUndo |
| A5b | Import history | importHistory | shows undone batch | ["undone"] | **PASS** |  | importHistory |
| A6 | Re-import after undo | re-preview | 494 accepted again | {"total":494,"accepted":494,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":0} | **PASS** |  | importPreview |
| A7-fixture_signed_amount.csv | CSV alt layout | fixture_signed_amount.csv | parsed without rejection | {"fmt":"csv:signed_amount","c":{"total":494,"accepted":494,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":0}} | **PASS** |  | importPreview |
| A7-fixture_bank_statement.csv | CSV alt layout | fixture_bank_statement.csv | parsed without rejection | {"fmt":"csv:debit_credit_columns","c":{"total":495,"accepted":494,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":1}} | **PASS** |  | importPreview |
| A8 | Malformed CSV | garbage csv | clean error, no crash | Could not find a header row with a date column and amount (or debit/credit) columns. Expected headers such as Date, Description, Debit, Credit or Amount. | **PASS** |  | importPreview |
| A9 | Empty CSV | empty content | clean error | The file is empty. | **PASS** |  | importPreview |
| B1 | SMS debit+credit accepted | 5 synthetic SMS | 2 accepted (debit 25000, credit 1200000) | {"counts":{"total":5,"accepted":2,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":3},"st":["ignored","ignored","ignored","accepted:debit25000","accepted:credit1200000"]} | **PASS** |  | importPreview sms |
| B2 | SMS OTP excluded | OTP message mentioning Rs 500 | not imported | ["ignored","ignored","ignored","accepted:debit25000","accepted:credit1200000"] | **PASS** |  | importPreview sms |
| B3 | SMS failed/pending rejected | failed 999 and pending 300 | not accepted as transactions | ["ignored","ignored","ignored","accepted:debit25000","accepted:credit1200000"] | **PASS** |  | importPreview sms |
| B4 | SMS duplicate prevention | same SMS again | 0 accepted | {"total":5,"accepted":0,"duplicate":2,"possibleDuplicate":0,"rejected":0,"ignored":3} | **PASS** |  | importPreview sms |
| B5 | Cross-source conflict (SMS vs CSV) | CSV row same date/amount as committed SMS | flagged duplicate or possible duplicate, not silently accepted | {"status":"possible_duplicate","reason":"same date, amount and direction as an existing transaction"} | **PASS** |  | importPreview |
| B6 | SMS dataset fields | dataset row keys | informational | ["id","source_ids","provenance","kind","rail","bank_or_app","sender_header","raw_sms","expected"] | **PASS** |  | dataset |
| C1-layout_a | PDF extraction exact | layout_a_debit_credit_columns.pdf | 24 rows identical to ground truth (date,direction,paise) | {"fmt":"pdf:debit_credit_columns","n":24,"counts":{"total":27,"accepted":24,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":3}} | **PASS** |  | importPreview pdf vs expected.json |
| C2-layout_a | PDF evidence | layout_a_debit_credit_columns.pdf | each row has page/line | true | **PASS** |  | evidence |
| C3 | PDF commit | layout_a_debit_credit_columns.pdf | committed | {"total":27,"accepted":24,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":3} | **PASS** |  | importCommit |
| C1-layout_b | PDF extraction exact | layout_b_amount_drcr_suffix.pdf | 24 rows identical to ground truth (date,direction,paise) | {"fmt":"pdf:amount_dr_cr_suffix","n":24,"counts":{"total":28,"accepted":0,"duplicate":16,"possibleDuplicate":8,"rejected":0,"ignored":4}} | **PASS** |  | importPreview pdf vs expected.json |
| C2-layout_b | PDF evidence | layout_b_amount_drcr_suffix.pdf | each row has page/line | true | **PASS** |  | evidence |
| C3b-layout_b | Cross-layout dedup | same transactions as committed layout A | all rows duplicate | {"total":28,"accepted":0,"duplicate":16,"possibleDuplicate":8,"rejected":0,"ignored":4} | **PARTIAL** | Low | importPreview; no double count at preview (0 accepted) but 16 duplicates + 8 possible duplicates; see C3c: committing imports the 8 possible duplicates |
| C1-layout_c | PDF extraction exact | layout_c_type_column_newest_first.pdf | 24 rows identical to ground truth (date,direction,paise) | {"fmt":"pdf:amount_type_column","n":24,"counts":{"total":25,"accepted":0,"duplicate":0,"possibleDuplicate":24,"rejected":0,"ignored":1}} | **PASS** |  | importPreview pdf vs expected.json |
| C2-layout_c | PDF evidence | layout_c_type_column_newest_first.pdf | each row has page/line | true | **PASS** |  | evidence |
| C3b-layout_c | Cross-layout dedup | same transactions as committed layout A | all rows duplicate | {"total":25,"accepted":0,"duplicate":0,"possibleDuplicate":24,"rejected":0,"ignored":1} | **PARTIAL** | Low | importPreview; all 24 rows come back as possible_duplicate (narration differs by layout); committing imports them (see C3c) |
| C4-scanned_image_only.pdf | PDF rejection/validation | scanned_image_only.pdf | rejected with reason | This PDF has no selectable text (it looks scanned). Scanned statements are not supported; download the digital statement from your bank or use CSV. | **PASS** |  | importPreview pdf |
| C4-layout_a_encrypted.pdf | PDF rejection/validation | layout_a_encrypted.pdf | rejected with reason | This PDF is password-protected. Enter its password to import it. | **PASS** |  | importPreview pdf |
| C4-text_without_table.pdf | PDF rejection/validation | text_without_table.pdf | rejected with reason | No transaction table was recognised. Supported layouts have a header row with a date column and either Debit/Credit (Withdrawal/Deposit) columns or an Amount column. | **PASS** |  | importPreview pdf |
| C4-too_many_pages.pdf | PDF rejection/validation | too_many_pages.pdf | rejected with reason | The PDF has more than 60 pages. Export a shorter period. | **PASS** |  | importPreview pdf |
| C4-variant_bad_running_ba | PDF rejection/validation | variant_bad_running_balance.pdf | rejected with reason | {"counts":{"total":27,"accepted":0,"duplicate":24,"possibleDuplicate":0,"rejected":0,"ignored":3},"reasons":[]} | **PARTIAL** | Low | importPreview pdf; invalid test: ledger already contained layout A so rows were duplicates; superseded by C4b-* run on a fresh ledger |
| C4-variant_debit_and_cred | PDF rejection/validation | variant_debit_and_credit_both_filled.pdf | rejected with reason | {"counts":{"total":27,"accepted":0,"duplicate":23,"possibleDuplicate":0,"rejected":1,"ignored":3},"reasons":["both debit and credit are filled"]} | **PASS** |  | importPreview pdf |
| C5 | Encrypted PDF with password | password demo-pass | parsed | {"total":27,"accepted":0,"duplicate":24,"possibleDuplicate":0,"rejected":0,"ignored":3} | **PASS** |  | importPreview pdf |
| C6 | Non-PDF bytes | text as pdf | clean error | This does not look like a PDF file. | **PASS** |  | importPreview pdf |
| C7 | Oversize PDF (6 MB) | 6,000,000 bytes | rejected FILE_TOO_LARGE | The PDF is larger than 5 MB. Export a shorter period. | **PASS** |  | importPreview pdf |
| C4b-variant_bad_running_balance | PDF validation (fresh ledger) | variant_bad_running_balance.pdf | bad/ambiguous rows rejected with reason, never silently accepted | {"counts":{"total":27,"accepted":24,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":3},"rejected":[],"warnings":["1 row(s) had a printed balance that does not follow from the amounts; the transaction was kept and that balance was ignored."]} | **PARTIAL** | Low | importPreview pdf; by design: row kept with a warning because the next row's balance corroborates the amount; not rejected |
| C4b-variant_amount_disagrees_with_balance | PDF validation (fresh ledger) | variant_amount_disagrees_with_balance.pdf | bad/ambiguous rows rejected with reason, never silently accepted | {"counts":{"total":27,"accepted":23,"duplicate":0,"possibleDuplicate":0,"rejected":1,"ignored":3},"rejected":["running balance does not reconcile with the previous balance and this amount"],"warnings":["1 row(s) did not match the running balance and were rejected instead of guessed.","1 row(s) could not be read and will be skipp | **PASS** |  | importPreview pdf |
| C4b-variant_amount_without_marker | PDF validation (fresh ledger) | variant_amount_without_marker.pdf | bad/ambiguous rows rejected with reason, never silently accepted | {"counts":{"total":28,"accepted":24,"duplicate":0,"possibleDuplicate":0,"rejected":0,"ignored":4},"rejected":[],"warnings":["24 row(s) had no Dr/Cr marker; their direction was derived from the running balance."]} | **PARTIAL** | Low | importPreview pdf; by design: direction derived from the running balance with a warning; accepted, not rejected |
| C4b-variant_amount_without_marker_or_balance | PDF validation (fresh ledger) | variant_amount_without_marker_or_balance.pdf | bad/ambiguous rows rejected with reason, never silently accepted | {"counts":{"total":28,"accepted":0,"duplicate":0,"possibleDuplicate":0,"rejected":24,"ignored":4},"rejected":["debit/credit direction is unclear (no marker, and the running balance does not settle it)","debit/credit direction is unclear (no marker, and the running balance does not settle it)"],"warnings":["Running balances were  | **PASS** |  | importPreview pdf |
| C3c | Cross-layout double counting | commit A (24), then B and C (same transactions, other layout) | ledger stays 24 | {"n1":24,"n2":32,"n3":56,"bCounts":{"total":28,"accepted":0,"duplicate":16,"possibleDuplicate":8,"rejected":0,"ignored":4},"bCommit":{"total":28,"accepted":0,"duplicate":16,"possibleDuplicate":8,"rejected":0,"ignored":4},"cCommit":{"total":25,"accepted":0,"duplicate":0,"possibleDuplicate":24,"rejected":0,"ignored":1}} | **FAIL** | High | importCommit |
| D1 | Merchant-level correction | ZOMATO x18 (was dining) -> entertainment applyToMerchant | all ZOMATO rows entertainment | {"updated":18,"cats":["entertainment"],"srcs":["user","learned"]} | **PASS** |  | correctCategory |
| D2 | Learned rule stored | listLearnedRules | 1 rule for zomato | ["zomato->entertainment"] | **PASS** |  | listLearnedRules |
| D3 | Breakdown reflects correction | Sep 2026 dining | dining excludes ZOMATO | 2981.57 | **PASS** |  | getBreakdown |
| D4 | Rule applied on re-import | undo, then re-import same CSV | ZOMATO rows -> entertainment (learned) | {"cats":["entertainment"],"src":["learned"]} | **PASS** |  | importCommit with learned rules |
| D5 | Precedence user > learned | single-row correction | that row groceries/user, others unchanged | {"cat":"groceries","src":"user"} | **PASS** |  | correctCategory |
| D6 | Delete rule reverts rule-derived rows only | deleteLearnedRule | non-user ZOMATO rows back to dining; user row kept | {"reverted":true,"keptUser":true,"cats":["dining","groceries"]} | **PASS** |  | deleteLearnedRule |
| D7 | Correct unknown tx | bad id | NOT_FOUND error | Transaction not found. | **PASS** |  | correctCategory |
| E0 | Reconciliation notes | snapshot dataQuality | flags CC repayments | ["card_repayment_counted","transfers_excluded","refunds_netted","assumption_averaging","assumption_definitions"] | **PASS** |  | getSnapshot.dataQuality |
| E1 | Exclude card repayments | 6 CC payments excluded | expenses 52976.04, surplus 32125.96, rate 37.75 | {"upd":6,"e":52976.04,"s":32125.96,"r":37.75} | **PASS** |  | reconcile + generator ground truth |
| E2 | Excluded rows remain visible | listTransactions | still 494 rows, flagged reconciliation | {"n":494,"flagged":6} | **PASS** |  | listTransactions |
| E3 | Consistency: report | Sep report after exclusion | expenses 45949.24 | 45949.24 | **PASS** |  | monthlyReport |
| E4 | Consistency: simulation baseline | simulate baseline surplus | 32125.96 | 32125.96 | **PASS** |  | simulate |
| E5 | Consistency: advisor | monthly review | contains 45949.24 | September 2026: you spent ₹45,949 and saved ₹39,357 (46.1%). The main thing to look at: look at fuel spending. Fuel was ₹2,978, 31.8% above your usual ₹2,260 (average of 3 earlier months). | **PASS** |  | ask |
| E6 | Undo reconciliation | decision undo | back to 57476.04 | 57476.04 | **PASS** |  | reconcile undo |
| E7 | Reconcile unknown id | bad id | error or updated 0 | One or more transactions were not found. | **PASS** |  | reconcile |
| E8 | Cross-user reconcile blocked | user B uses user A's tx id | no update | One or more transactions were not found. | **PASS** |  | reconcile isolation |
| F1 | Subscription detection | listSubscriptions | recurring items found | ["Hdfc Bank XX:monthly:possible:4500","Cult.fit GYM Membership Autopay:monthly:possible:1500","Netflix:monthly:possible:649","Youtube Premium:monthly:possible:129","Spotify:monthly:possible:119","Apple Icloud:monthly:possible:75"] | **PASS** |  | listSubscriptions |
| F1b | Recurring vs generator labels | labels.csv is_recurring=1 narrations | informational | {"labelled":39,"detected":6,"labelledSample":["NEFT-ACME TECHNOLOGIES PVT LTD-SALARY","CULT.FIT GYM MEMBERSHIP AUTOPAY","UPI/436180337321/RENT TO LANDLORD/RAJESH.K@OKSBI/HOUSE RENT","SIP MUTUAL FUND GROWW ACH DEBIT","UPI/990431397265/NETFLIX/NETFLIX@ICICI/SUBSCRIPTION","RD INSTALMENT SAVINGS GOAL","UPI/931062678575/SPOTIFY/SPOTI | **PASS** |  | labels.csv |
| F2 | Price increase flag | listSubscriptions | at least one price_increase flag if fixtures contain one | none flagged | **PARTIAL** | Low | listSubscriptions; no price-increase flag was produced on the synthetic CSV; the code path is covered by a unit test, not by this data |
| F3 | Confirm and dismiss | confirm Hdfc Bank XX, dismiss Cult.fit GYM Membership Autopay | confirmed / dismissed; dismissed excluded from total | {"a":"confirmed","b":"dismissed","totBefore":6972,"totAfter":5472} | **PASS** |  | confirmSubscription |
| F4 | Cancel-subscription simulation | cancel Hdfc Bank XX,Netflix | surplus +5149.00 (sum of monthlyEquivalent) | {"delta":5149,"base":27625.96} | **PASS** |  | simulate vs listSubscriptions |
| F5 | Simulation did not mutate | snapshot before/after simulate | identical | {"before":27625.96,"after":27625.96} | **PASS** |  | getSnapshot |
| G1 | Create goal + projection | target 10L, current 1L, 10k/month | remaining 9,00,000; 90 months; completion about 2034-05 | {"remaining":900000,"progress":10,"completion":"2034-04-30","status":"no_deadline"} | **PASS** |  | getGoals vs own arithmetic; first run FAILED due to an audit-script date bug (Oct 31 + 90 months overflows into May); app value 2034-04-30 is correct: 900000/10000 = 90 months from 2026-10 |
| G2 | Update goal | contribution 20k | 45 months | 2030-07-31 | **PASS** |  | upsertGoal |
| G3 | Goal-contribution what-if | 10k->20k stored; what-if 40k | completion in 22.5 months (23rd month) vs baseline 45 | {"base":"2030-07-31","scen":"2028-09-30","saved":22} | **PASS** |  | simulate |
| G4 | Invalid goal | negative target | validation error | The request was not valid. Check the highlighted fields. | **PASS** |  | upsertGoal |
| G5 | Delete goal | deleteGoal | gone | 0 | **PASS** |  | deleteGoal |
| G6 | What-if on deleted goal | deleted id | error or insufficient, no crash | That goal was not found. List your goals and pick an id from there. | **PASS** |  | simulate |
| H1 | Report months | listReportMonths | 2026-04..2026-09 | ["2026-09","2026-08","2026-07","2026-06","2026-05","2026-04"] | **PARTIAL** | Low | listReportMonths (order: 2026-09 first) |
| H2-2026-04 | Report totals vs ground truth | 2026-04 | income 85000, expenses 53294.64 | {"i":85000,"e":53294.64} | **PASS** |  | monthlyReport vs expected.json |
| H2-2026-05 | Report totals vs ground truth | 2026-05 | income 85000, expenses 50243.9 | {"i":85000,"e":50243.9} | **PASS** |  | monthlyReport vs expected.json |
| H2-2026-06 | Report totals vs ground truth | 2026-06 | income 85296, expenses 51089 | {"i":85296,"e":51089} | **PASS** |  | monthlyReport vs expected.json |
| H2-2026-07 | Report totals vs ground truth | 2026-07 | income 85000, expenses 69833.39 | {"i":85000,"e":69833.39} | **PASS** |  | monthlyReport vs expected.json |
| H2-2026-08 | Report totals vs ground truth | 2026-08 | income 85000, expenses 52145.48 | {"i":85000,"e":52145.48} | **PASS** |  | monthlyReport vs expected.json |
| H2-2026-09 | Report totals vs ground truth | 2026-09 | income 85306, expenses 50449.24 | {"i":85306,"e":50449.24} | **PASS** |  | monthlyReport vs expected.json |
| H3 | Insufficient-data state | Jan 2025 (no data) | status insufficient_data, zero totals not presented | {"st":"insufficient_data"} | **PASS** |  | monthlyReport |
| H4 | Drift and actions | Sep 2026 | drift items + <=3 evidence-linked actions | {"drift":["fuel up 31.75%","health down -28.55%","shopping down -62.09%"],"actions":["Look at fuel spending|ev:2","Review a large payment|ev:1","Confirm flagged transactions|ev:1"]} | **PASS** |  | monthlyReport |
| H5 | Partial-month handling | Oct 2026 with data only to 06/10 (system date 2026-10-31) | partial flag or reason shown | {"status":"ok","period":{"from":"2026-10-01","to":"2026-10-31","daysInMonth":31,"daysElapsed":31,"partial":true,"reason":"October 2026 is still in progress (day 31 of 31); figures cover only what was imported up to 2026-10-06."},"dq":["partial_month","insufficient_history_for_drift"]} | **PASS** |  | monthlyReport.period |
| I1 | Grounded spend question | dining last month | Sep dining = 3377 (labels.csv ground truth), Aug 4506 | {"ans":"In September 2026 you spent ₹3,377 on dining & delivery. That is ₹1,130 less than August 2026 (₹4,506).","engine":{"kind":"deterministic","llmUsed":false,"model":null},"mode":"fallback"} | **PASS** |  | ask vs labels.csv |
| I2 | Recurring payments | subscriptions question | mentions Netflix | I detect 6 recurring payments costing about ₹6,972 a month: Hdfc Bank XX (₹4,500), Cult.fit GYM Membership Autopay (₹1,500), Netflix (₹649), Youtube Premium (₹129), Spotify (₹119). | **PASS** |  | ask |
| I3 | Report question | monthly report September | mentions September totals | September 2026: you spent ₹50,449 and saved ₹34,857 (40.9%). The main thing to look at: look at fuel spending. Fuel was ₹2,978, 31.8% above your usual ₹2,260 (a | **PASS** |  | ask |
| I4 | Goals question | after creating Japan trip goal | mentions Japan trip and 25% | Japan trip: ₹50,000 of ₹2,00,000 (25%); at ₹10,000 a month it completes around 2028-01-31. | **PASS** |  | ask |
| I5 | Unsafe advice refusal | stock tip request | refused, no stock names/returns promised | {"intent":"unsafe_request","guard":{"status":"refused","reasons":["Specific investment recommendations and guaranteed-return claims are not allowed."]},"ans":"I can't recommend specific investments or promise returns. I can show you what your own transactions say about spending, saving and recurring payments, or test "} | **PASS** |  | ask |
| I6 | Clarification for missing value | no category | asks which category | {"ans":"Which spending category do you mean?","clar":true} | **PASS** |  | ask |
| I7 | What-if via advisor, independent expectation | cut dining 30% | surplus delta ~ 1247 (30% of Jul-Sep dining mean from labels.csv) | {"delta":1246.97,"ans":"Testing that on your 3-month average: monthly spending goes from ₹57,476 to ₹56,229 (₹1,247 lower), and your savings rate goes from 32.5% to"} | **PASS** |  | ask.simulation vs labels.csv |
| I8 | Contextual follow-up | 'make it 50%' with previous context | delta ~ 2078 | {"delta":2078.29,"intent":"what_if"} | **PASS** |  | ask previous |
| I8b | Same utterance WITHOUT context | 'make it 50%' cold | should ask for clarification, not guess | I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactions, and wh | **PASS** |  | ask |
| I9 | Input length bound | 1001 chars | validation error | The request was not valid. Check the highlighted fields. | **PASS** |  | ask |
| I10 | No data, no fabricated amounts | fresh user | no rupee amounts in answer | {"ans":"I do not have any of your transactions yet, so I cannot answer from your own numbers. Import a bank statement (CSV) or paste SMS alerts first.","amounts":[]} | **PASS** |  | ask |
| I11 | No data, other question | fresh user | no invented numbers | {"ans":"I do not have any of your transactions yet, so I cannot answer from your own numbers. Import a bank statement (CSV) or paste SMS alerts first."} | **PASS** |  | ask |
| I12 | Out-of-scope calculation | SIP future value | refuse, clarify or be grounded; must not invent | {"intent":"what_if","ans":"Testing that on your 3-month average: monthly spending goes from ₹57,476 to ₹57,476 (no change), and your savings rate goes from 32.5% to 32.5%. Over 12 months that leaves ₹2,71,512 versus ₹3,31,512 n"} | **FAIL** | Medium | ask (see NLP report); SIP future-value question was routed to a what-if and answered with an unchanged-spending result ('no change'), silently ignoring the request |
| J1 | Determinism | same combined scenario twice | identical output | true | **PASS** |  | simulate x2 |
| J2 | Combined scenario arithmetic | income -10000 and dining -30% | surplus 18872.93 | 18872.93 | **PASS** |  | simulate vs own arithmetic |
| J3 | Scenario reduce_category | {"type":"reduce_category","category":"shopping","amountPerMonth":1000} | status ok or honest insufficient_data/warning; ledger untouched | {"status":"ok","warn":["Your emergency-fund balance is not provided, so emergency-fund cover is not shown.","The baseline includes 1 unresolved data-quality flag(s) (card_repayment_counted); the results inherit them. See evidence."],"m":["Monthly income:85102->85102","Monthly expenses:57476.04->56476.04","Monthly surplus:27625.9 | **PASS** |  | simulate |
| J4 | Scenario one_off_expense | {"type":"one_off_expense","amount":60000,"inMonths":2} | status ok or honest insufficient_data/warning; ledger untouched | {"status":"ok","warn":["Your emergency-fund balance is not provided, so emergency-fund cover is not shown.","The baseline includes 1 unresolved data-quality flag(s) (card_repayment_counted); the results inherit them. See evidence."],"m":["Monthly income:85102->85102","Monthly expenses:57476.04->57476.04","Monthly surplus:27625.9 | **PASS** |  | simulate |
| J5 | Scenario pay_down_debt | {"type":"pay_down_debt","amountPerMonth":5000} | status ok or honest insufficient_data/warning; ledger untouched | {"status":"ok","warn":["Your credit-card balance is not provided, so the payoff time cannot be estimated. Add it to see months to clear.","Your emergency-fund balance is not provided, so emergency-fund cover is not shown."],"m":["Monthly income:85102->85102","Monthly expenses:57476.04->57476.04","Monthly surplus:27625.96->27625. | **PASS** |  | simulate |
| J6 | Scenario start_sip | {"type":"start_sip","amountPerMonth":5000} | status ok or honest insufficient_data/warning; ledger untouched | {"status":"ok","warn":["Your emergency-fund balance is not provided, so emergency-fund cover is not shown.","Your investment balance is not provided, so only the monthly SIP flow is modelled, not a portfolio value."],"m":["Monthly income:85102->85102","Monthly expenses:57476.04->57476.04","Monthly surplus:27625.96->27625.96"]} | **PASS** |  | simulate |
| J7 | No ledger mutation by simulations | snapshot before/after 6 simulations | identical | {"b":27625.96,"a":27625.96,"n":494} | **PASS** |  | getSnapshot |
| J8 | Absurd reduction (more than the category) | reduce dining by 1 crore | must cap at actual spend or warn | {"m":4156.58,"warn":["Reducing \"dining\" was capped at its current monthly spend of ₹4,156.58.","Your emergency-fund balance is not provided, so emergency-fund cover is not shown."]} | **PASS** |  | simulate |
| J9 | Simulation with no data | fresh user | insufficient_data, no invented baseline | insufficient_data | **PASS** |  | simulate |
| K1 | Refund claim does not count as cash | createClaim 4500 | snapshot+report unchanged | {"s":true,"r":true} | **PASS** |  | createClaim |
| K2 | Claim status | list after create (credits exist already in ledger) | pending/overdue until confirmed | overdue | **PASS** |  | listClaims |
| K3 | Match suggestion ranking | claimMatches | Amazon refund credit ranked first; decoy 'FRIEND RETURN' lower/ambiguous | ["AMAZON REFUND ORDER :1.1:true","UPI/FRIEND RETURN/ra:0.75:false"] | **PASS** |  | claimMatches |
| K4 | Confirm match | confirm Amazon credit | claim received, outstanding 0 | {"st":"received","out":0} | **PASS** |  | confirmClaimMatch |
| K5 | No double allocation of a credit | second claim uses same credit | rejected (fully allocated) | The request was not valid. Check the highlighted fields. | **PASS** |  | confirmClaimMatch |
| K6 | Undo match | undo | claim pending again | overdue | **PASS** |  | undoClaimMatch |
| K7 | Partial reimbursement | owed 2000, received 1200 | partially received, 800 outstanding | {"st":"partially_received","out":80000} | **PASS** |  | confirmClaimMatch |
| K8 | Over-allocation beyond claim | apply 4500 credit to 800 outstanding | rejected or capped at 800 | That is more than this claim is still expecting. | **PASS** |  | confirmClaimMatch |
| K9 | Reimbursement settled; gross vs personal | dinner 3000, others owe 2000 | received; gross reimbursable 3000, personal share 1000 | {"st":"received","sum":{"pendingRefundPaise":0,"overdueRefundCount":0,"outstandingReimbursementPaise":0,"grossReimbursableSpendPaise":300000,"personalShareOfReimbursablePaise":100000}} | **PASS** |  | listClaims.summary |
| K10 | Snapshot treats reimbursements | after settling | reimbursement credits are income in existing totals (known limitation) unless adjusted | {"income":100000,"exp":6000} | **PARTIAL** | Low | documented limitation: claims never rewrite base totals |
| K11 | Manual entry idempotency | same key twice | one transaction added | {"before":12,"after":13,"dup":true,"src":"manual"} | **PASS** |  | manualEntryCommit |
| K12 | Manual entry undo | importUndo(batchId) | removed | {"st":"undone","n":12} | **PASS** |  | importUndo |
| K13 | Manual preview missing amount | no amount | needsUserInput contains amount | ["amount"] | **PASS** |  | manualEntryPreview |
| K14 | Future date rejected | 2030 | error | A manual entry cannot be dated in the future. | **PASS** |  | manualEntryPreview |
| K15 | Data coverage gaps | dataCoverage | lists gaps without inventing data | ["quiet_period","quiet_period","quiet_period","no_manual_entries"] | **PASS** |  | dataCoverage |
| K16 | EMI true cost (independent) | 40000 upfront vs 6700x6 + 500 fee | EMI total 40700, extra 700 | {"emi":4070000,"extra":70000,"missing":["taxes (for example GST on interest or the fee)","any discount or cashback you only get by paying upfront"]} | **PASS** |  | emiCheck vs 6*6700+500 |
| K17 | EMI genuinely no-cost | 30000 vs 5000x6 | extra 0, isReallyNoCost, missing terms listed | {"extra":0,"nc":true,"miss":3} | **PASS** |  | emiCheck |
| K18 | EMI hidden discount | upfront discount 1500 | EMI costs 1500 more | 150000 | **PASS** |  | emiCheck |
| K19 | EMI creates no ledger entries | after 3 emiChecks | unchanged | 12 | **PASS** |  | getSnapshot |
| L1 | Two identities isolated | A imported, B fresh | B sees 0 | {"a":494,"b":0} | **PASS** |  | getSnapshot x2 |
| L2 | B cannot mutate A's transaction | correctCategory with A id | not found | Transaction not found. | **PASS** |  | correctCategory |
| L3 | B list empty | listTransactions | 0 | 0 | **PASS** |  | listTransactions |
| L4 | Forged cookie | invalid signature | treated as a fresh identity, not someone else's | 0 | **PASS** |  | getSnapshot |
| L5 | clearMyData needs DELETE | confirm=nope | rejected | The request was not valid. Check the highlighted fields. | **PASS** |  | clearMyData |
| L6 | clearMyData | confirm DELETE | everything gone | {"cl":494,"n":0} | **PASS** |  | clearMyData |
| L7 | clear also clears goals/claims? | getGoals after clear | no residual personal data | 0 | **PASS** |  | getGoals |
| S1 | Tampered signature on A's real uuid | valid format, wrong HMAC | must NOT see A's data | 0 | **PASS** |  | identity.verify |
| S2 | Swapped uuid with A's signature | forge another user's id | no data | 0 | **PASS** |  | identity.verify |
| S3 | Cross-user preview commit | B commits A's previewId | rejected | This import preview has expired or does not exist. Upload the file again. | **PASS** |  | importCommit |
| S5 | Rate limiting | 400 concurrent meta calls | some 429 expected for a public service | {"200":400} | **FAIL** | Medium | no rate limiter in source (grep) and none observed |
| S6 | Body limit 9 MB | 9,000,000-char CSV | 413/400 not crash | 413 | **PASS** |  | express.json limit 8mb |
| S6b | Server alive after oversize | health | 200 | 200 | **PASS** |  | health |
| S7 | Formula/HTML in narration | =HYPERLINK, <script> | accepted as inert text; UI must render as text | ["=HYPERLINK(\"http://evil\")","<script>alert(1)</script>"] | **PASS** |  | importPreview (React escapes on render) |
| S8 | Odd previous context | __proto__ in previous | no crash | ok | **PASS** |  | ask |
| S9 | Invalid month param | month=<script> | validation error | 400 | **PASS** |  | getBreakdown |
| S10 | Legacy WealthVerse route reachable | profiles.list | informational | 200 | **PASS** |  | legacy routers remain |
| S11 | Security headers | GET /inari | CSP, X-Content-Type-Options, HSTS(on https) | {"csp":null,"xcto":null,"xpb":"Express"} | **FAIL** | Low | response headers |

## Persistence and restart (separate processes)

| ID | Test | Result | Evidence |
|---|---|---|---|
| L8 | JSON store (`INARI_LEDGER_STORE=json`): import 494 tx, merchant rule, goal; kill process; restart; same cookie | **PASS** | READ json tx 494, exp 57476.04, goals 1, rules 1. File `ledger.json` ~290 KB written atomically |
| L9 | Memory store: same sequence | **PASS (documented loss)** | READ memory tx 0, goals 0, rules 0; `meta.storage` says "lost when the server restarts" |
| L10 | JSON store: claims persist across restart | **NOT TESTED over HTTP** | My claim-create call was rejected (test input error); persistence of claims/manual entries is covered only by unit test `inari.novelty.advisor.test.ts` "durability in json store mode" |
| L11 | Same-browser reload (browser) | **PASS** | Reload of `/inari` kept 495 transactions and the same snapshot |

## Browser (`/inari`, built-in browser, production build) — from the previous session, re-stated honestly

| ID | Flow | Result | Evidence |
|---|---|---|---|
| BR1 | Load sample CSV, preview, confirm import | **PASS** | 494 new rows; snapshot ₹85,102 / ₹57,476.04 / ₹27,625.96 / 32.46% |
| BR2 | Type a question, Enter submits | **PASS** | Real keystrokes; answer "₹3,377 dining in September vs ₹4,506 August"; text sent exactly as typed incl. "no wait, I mean this month" |
| BR3 | Cash entry preview and Confirm card | **PASS** | Preview for ₹350 on 2026-10-30; Confirm → "Done", ledger 495 |
| BR4 | What-if (income -10000) | **PASS** | surplus 27,625.96 → 17,625.96 |
| BR5 | EMI check | **PASS** | extra ₹700 for ₹40,000 vs 6×6,700+500 |
| BR6 | Monthly report | **PARTIAL** | Rendered; defaulted to April (oldest). A fix to default to the newest month was built later and **not re-verified in the browser** |
| BR7 | Fresh identity | **PASS** | Via HTTP cookie jars (above), not a second browser profile |
| BR8 | SMS, PDF upload, goals, claims, reconcile, subscriptions, correction in the UI | **NOT TESTED / NOT BUILT** | `/inari` has no UI for these; they are HTTP-only. PDF upload code path exists in the page but was not exercised in a browser |
| BR9 | Wispr Flow dictation | **NOT TESTED** | Wispr Flow not exercised on this machine; only synthetic keystrokes were used |
