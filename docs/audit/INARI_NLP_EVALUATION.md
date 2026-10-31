# INARI NLP evaluation

## 1. What the NLP actually is

Every language component in the INARI path is **hand-written rules and regular expressions**. There is no statistical model, no embeddings, no transformer, and no LLM call anywhere in `inari.ask` (`engine: {kind:"deterministic", llmUsed:false}`; `mode:"fallback"`).

| Layer | File | Mechanism |
|---|---|---|
| Intent, quantities, what-if scenario | `server/inari/nlp/intent.ts` (308 lines) | Normalisation, filler removal (`FILLERS`), number words to digits (`wordsToDigits`), `k/lakh/crore` multipliers, correction cues (`CUE`), ordered regex chain (`UNSAFE`, `WHAT_IF`, `CORRECTION`, `SUBS`, `REVIEW`, `SPEND_Q`, `GOAL`) |
| Advisor routing and answers | `server/inari/advisor.ts` (742 lines) | Intent to handler; `FactBook` makes every printed amount traceable to a computed figure; the guardrail rejects unregistered amounts |
| Novelty routing (refund / owe / EMI / manual) | `advisor.ts` `noveltyKind()`, `noveltyDraft()` | A second, separate regex router placed after the first, with its own number parser (`rupeeAmounts`) that requires a rupee marker (₹, Rs, rupees, k) and does not read number words |
| Manual-entry text | `server/inari/manual.ts` `parseText()` | Regex amount, date and payment-type extraction; self-correction by a "sorry / I mean / actually" cue |
| Categorisation | `server/inari/categorize.ts` | Ordered regex rules, learned merchant rules, user corrections. No model |
| Legacy WealthVerse NLP | `server/wealth/nlp/*` | Rule-based intent classifier, synonym dictionary, entity extractor (6 tests). Legacy `advisorEngine.ts` can call an external chat model if `BUILT_IN_FORGE_API_KEY` is configured; INARI routes never do (`inari.noexternal.test.ts`) |

**Label accuracy.** `engine.llmUsed:false` and "Deterministic financial reasoning" are accurate. The comment in `categorize.ts` ("rules + user feedback, NOT a trained or fine-tuned model") is accurate. Nothing in INARI claims a model it does not have. One imprecise label: the contract field `mode: "llm" | "fallback" | "stub"` always returns `"fallback"` in INARI, which reads as "degraded" although it is the only mode.

## 2. Capability by feature

| Feature | Supported? | Evidence |
|---|---|---|
| Indian units (k, lakh, lac, crore, 1,23,456) | Yes in `intent.ts`; **no** in the novelty router | N01, N02, N06 |
| Number words ("five thousand") | Yes in `intent.ts`; **no** in the novelty / manual router | N01, N06 |
| Self-correction | Yes when digits are used and the manual router is reached | unit tests; N18 fails because routing never reaches manual entry |
| Fillers and disfluencies | Yes (um, uh, you know) | unit tests |
| Several intents in one utterance | **No**: the first matching regex wins; two categories trigger a question | N04 |
| Ambiguous transaction references | Partial: claims ask for a transaction when more than one fits | K-series in the acceptance report |
| Relative dates | manual entry: yesterday / today / N days ago / dd-mm-yyyy; intent: last / this / next month, named month | N02 fails, N30 passes |
| Follow-ups | Yes, but via **client-echoed context** (`previous`); the server keeps no conversation state | I8 vs I8b |
| Persistent memory | Ledger, goals, claims and rules persist (store-dependent). Conversation memory: none | persistence tests |
| Hindi / Hinglish / Tamil | **None by design.** Incidental English keywords ("refund") match | N05 passes by keyword; N21, N29 |
| Out-of-distribution phrasing | Falls to `unknown` with a generic help message (safe), but sometimes mis-routes | N01, N23 |
| External model providers | None for INARI routes. Legacy routes only if a key is configured; none in `render.yaml` | code + `inari.noexternal.test` |

## 3. Independent adversarial test set

**Design.** 30 utterances written for this audit (none copied from the existing test files), run through the production server's `inari.ask` against the 494-row synthetic ledger, one cold call each (no `previous`).

**Scoring.** An item is correct only if (a) the effective intent (`response.context.intent`, falling back to `response.intent.intent`) is in the acceptable set I fixed *before* running, and (b) where the utterance carries an amount that the answer or proposed action should reflect, that exact number appears in the answer or proposed input. Items with two defensible labels list both. Negative controls (joke, weather, Tamil) are correct when the intent is `unknown`. The labels were written by the auditor and the set is small, so treat the percentages as indicative, not a benchmark.

| ID | Utterance | Acceptable | Got | Amount | Result | Note / answer |
|---|---|---|---|---|---|---|
| N01 | I spent two thousand five hundred on groceries yesterday | manual_entry | spending_question | false | **MISS** | number words, no currency symbol — In September 2026 you spent ₹5,530 on groceries. That is ₹1,504 less than August 2026 (₹7,034). |
| N02 | paid 1.5 lakh rupees for the course in cash 3 days ago | manual_entry | unknown | false | **MISS** | lakh + relative date — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N03 | Swiggy charged me 450, no wait, 540 for dinner | manual_entry / spending_question | unknown | false | **MISS** | spoken correction, bare merchant phrase — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N04 | What if I earn fifty thousand rupees more and also cut dining by half? | what_if | what_if | n/a | **OK** | two scenarios in one utterance |
| N05 | Mera refund kab aayega? | refund_status | refund_status | n/a | **OK** | Hinglish refund |
| N06 | My roommate owes me eight hundred for the electricity bill | reimbursement_status | reimbursement_status | false | **MISS** | number word reimbursement — I am not tracking any reimbursements yet. Tell me the amount and which payment it relates to and I can start tracking it. It will not count as money r |
| N07 | Is paying 5,000 monthly for 12 months on a 55k laptop really no cost EMI? | emi_check | emi_check | true | **OK** | EMI with k shorthand |
| N08 | Should I put all my savings in bitcoin? | unsafe_request | unknown | n/a | **MISS** | unsafe investment advice — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N09 | Tell me a joke | unknown | unknown | n/a | **OK** | out of scope |
| N10 | Show me spending on petrol in August | spending_question | spending_question | n/a | **OK** | category+named month |
| N11 | Reduce my rent by 10 percent | what_if | unknown | n/a | **MISS** | percent what-if — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N12 | How much do I pay for Netflix and Spotify combined? | subscription_query / spending_question | subscription_query | n/a | **OK** | two merchants |
| N13 | stop my Netflix | what_if / subscription_query | unknown | n/a | **MISS** | imperative cancel — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N14 | Transfer 5000 to my mother | unsafe_request | unknown | n/a | **MISS** | action request — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N15 | Will I be able to afford a 30 lakh house in 5 years? | goal_progress / what_if / clarification_followup | unknown | n/a | **MISS** | aspirational goal — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N16 | Cancel the gym membership | what_if / subscription_query | unknown | n/a | **MISS** | cancel by name — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N17 | I got my money back from Flipkart | refund_status / manual_entry | unknown | n/a | **MISS** | refund received statement — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N18 | actually not 300, make it 450 - I paid 450 cash for the auto today | manual_entry | unknown | false | **MISS** | correction cue first — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N19 | what happened to my savings in August | monthly_review / spending_question | unknown | n/a | **MISS** | vague report request — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N20 | how much did i spend on dining and groceries last month | spending_question | spending_question | n/a | **OK** | two categories |
| N21 | இந்த மாதம் எவ்வளவு செலவு செய்தேன் | unknown | unknown | n/a | **OK** | Tamil: unsupported, must degrade safely |
| N22 | Where does all my money go? | spending_question | unknown | n/a | **MISS** | colloquial — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N23 | I will earn 20k less next month, what then? | what_if | unknown | false | **MISS** | income drop shorthand — I can't recommend specific investments or promise returns. I can show you what your own transactions say about spending, saving and recurring payments |
| N24 | Is the EMI on this fridge worth it? 45000 or 4000 for 12 months | emi_check | emi_check | false | **MISS** | price OR monthly phrasing — To compare the EMI with paying upfront I need the cash price, the monthly instalment. Also tell me about any processing fee, taxes, or a discount you  |
| N25 | What's the weather today? | unknown | unknown | n/a | **OK** | out of scope |
| N26 | Pay my rent now | unsafe_request | unsafe_request | n/a | **OK** | action request |
| N27 | I spent 500 and then 200 on lunch cash | manual_entry | unknown | n/a | **MISS** | multiple amounts: should disambiguate — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N28 | Does the refund for my headphones from last week count in my income? | refund_status | refund_status | n/a | **OK** | question about refund semantics |
| N29 | mujhe 5 hazaar ka cash kharcha likhna hai | manual_entry | unknown | false | **MISS** | Hinglish manual entry — I can answer questions about your own imported transactions: spending by category or merchant, recurring payments, monthly reviews, flagged transactio |
| N30 | I spent ₹350 cash yesterday | manual_entry | manual_entry | true | **OK** | supported phrase from brief (control) |

## 4. Score

**12/30 = 40%** overall on out-of-sample phrasing.

| Slice | Correct | Comment |
|---|---|---|
| Negative controls (N09, N21, N25) | 3/3 | Safe degradation to `unknown` |
| Unsafe / action requests (N08, N14, N26) | 1/3 | "Pay my rent now" refused; "Transfer 5000 to my mother" and "all my savings in bitcoin" fall to `unknown` (nothing executed, nothing fabricated, but no explicit refusal) |
| Manual-entry statements (N01, N02, N03, N18, N27, N29, N30) | 1/7 | Only the exact supported phrase (N30, a control) passes; number words, lakh, correction-first, two amounts and Hinglish fail |
| What-if (N04, N11, N13, N16, N23) | 1/5 | Works for "what if…" phrasing; "Reduce my rent by 10 percent", "stop my Netflix", "Cancel the gym membership" are `unknown` |
| EMI (N07, N24) | 2/2 intent, 1/2 with values | N24 ("45000 or 4000 for 12 months") asks for terms already given |
| Refund / owe (N05, N06, N17, N28) | 3/4 intent; 2/4 with amounts | N06 recognised but ignored "eight hundred" |
| Spend / report questions (N10, N12, N19, N20, N22) | 3/5 | "Where does all my money go?" (extra word "all") and "what happened to my savings in August" fail |

The phrasings named in the brief ("I spent ₹350 cash yesterday", "Where is my refund?", "My friends owe me ₹2,000.", "Is this EMI actually cheaper?") work. **Robustness outside those phrasings is low**: roughly 40% on unseen phrasing.

## 5. Defects found (not fixed, per audit rules)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| NLP-1 | **High for a voice demo** | A spoken *statement* of spending ("I spent 2500 on groceries yesterday", or in words) is routed to `spending_question` and answered with the September grocery total (₹5,530): a real number that does not answer the user. The manual-entry router needs a rupee marker and runs after the first router | N01; `analyzeIntent` returns `spending_question` for both forms |
| NLP-2 | Medium | "I will earn 20k less next month, what then?" returns the *investment-advice refusal* (`guardrail.status:"refused"`, reason "Specific investment recommendations…") for a budgeting question. Root cause not isolated (probably a guardrail pattern on "earn"); behaviour observed over HTTP | N23 |
| NLP-3 | Medium | Two number parsers with different abilities, so the same utterance behaves differently depending on which router fires | N01, N02, N06 |
| NLP-4 | Medium | A SIP future-value question is answered by a what-if reporting "no change" | acceptance I12 |
| NLP-5 | Low | Imperative what-ifs unsupported (needs "what if" or "if I …") | N11, N13, N16 |
| NLP-6 | Low | "make it 50%" without context correctly falls back to help text; context is client-echoed only | I8b |

## 6. Conclusion

The NLP is a competent, deterministic, auditable **rule system for a narrow set of English phrasings**, with good safety properties (no model, no network, every amount traceable, unknown falls back to generic help). It is **not** a general language-understanding engine, has **no multilingual capability**, and degrades quickly on unseen phrasing. Voice-first claims should be limited to the listed phrasings plus standard-English what-if and spending questions.
