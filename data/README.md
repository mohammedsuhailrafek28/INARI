# INARI data

Everything here is **synthetic or redacted**. No real personal banking data, credentials or unredacted SMS is stored in this repository. Datasets are kept apart by purpose so a test set can never leak into a training set.

| Folder | Purpose | Source | Licence | Status |
|---|---|---|---|---|
| `demo/` | Demonstration + acceptance fixtures | Our own seeded generator (`generator/`) | Project licence | Implemented, verified |
| `parser-tests/sms/` | Isolated SMS parser tests | [skyaara/indian-payment-sms-dataset](https://github.com/skyaara/indian-payment-sms-dataset) @ `ef81c75` | CC BY 4.0 (attribution required) | Copied, integrity-tested; SMS parser **not implemented yet** |
| `training/` | Future SLM / classifier work | [Ranjit0034/finee-dataset](https://huggingface.co/datasets/Ranjit0034/finee-dataset) | Apache-2.0 | **Not downloaded** (see its README) |
| `external-eval/` | Independent validation | [DylanOrazi/Personal-Finance-Spending-Dashboard](https://github.com/DylanOrazi/Personal-Finance-Spending-Dashboard) | **No licence declared** | **Not copied** (see its README) |

## `demo/` — fictional salaried profile (seed `20261031`)

Regenerate: `python -I data/generator/generate_synthetic_profile.py --out data/demo`
Check reproducibility: `python -I data/generator/check_determinism.py` (regenerates twice, compares to `MANIFEST.sha256`).

- 494 transactions, 1 Apr – 28 Sep 2026, one fictional account. Fixed monthly salary (₹85,000), rent (₹18,000), 5 subscriptions, SIP (₹5,000, investment), RD instalment (₹3,000, savings goal), utilities, insurance, a monthly credit-card repayment, and ~26–32 UPI micro-payments a month. Scripted events: one large purchase (₹18,000, Jul), one refund (Aug), two self-transfers, quarterly interest.
- Three importable layouts of the **same** rows: `fixture_debit_credit.csv` (separate Debit/Credit), `fixture_signed_amount.csv` (signed `Amount`, ISO dates), `fixture_bank_statement.csv` (preamble, `Chq./Ref.No.`, Indian digit grouping, `dd/mm/yy`, running balance, footer).
- `labels.csv` holds the generator's own category and recurring flag per row. **Evaluation only.** Importable files contain no category/recurring column and the classifier never reads `labels.csv`.
- `expected.json` is computed by the generator from its labels, independently of INARI's code. Last three complete months (Jul–Sep): income ₹85,102.00, expenses ₹57,476.04, surplus ₹27,625.96, savings rate 32.46%. Policy: refunds reduce expenses; investment/savings/transfer are neutral; **the credit-card repayment is counted as an expense by default** (INARI cannot see card spend) and is flagged as a reconciliation exception. `snapshot_if_cc_repayment_excluded` (expenses ₹52,976.04, rate 37.75%) is provided so the user-resolved alternative can be tested too.
- `sms_matching_examples.json`: five synthetic SMS describing rows of the statement (exact match, uncertain match that must **not** be auto-merged, decoys). For future cross-source dedupe tests.

**Limitations.** One synthetic person, fixed salary and round-number commitments, so it is cleaner than real statements. The merchant vocabulary was written next to the categorizer rules, so the 100% categorizer accuracy on this fixture is an in-distribution check, **not** an estimate of real-world accuracy. The generator is independent code; the idea of merchant templates with amount ranges is inspired by [esaipavan/synthetic-finance-data](https://github.com/esaipavan/synthetic-finance-data) (MIT), whose output was not usable directly because it draws dates independently and cannot give a consistent monthly profile. No code or data was copied from it.

## `parser-tests/sms/`

172 redacted rewrites (58 seeds + 114 numeric variants) with expected labels (`bookable`, direction, amount in paise, merchant, reference). 78 rows are bookable debits; the rest are credits/refunds/reversals and hard negatives (upcoming debits, declined, failed, mandates, OTP/non-financial) that a parser must refuse to book. Files: `indian-payment-sms-dataset.json`, `LICENSE` (CC BY 4.0), `CITATION.cff`, and `ATTRIBUTION.md`. We use it unchanged. It is a parser-regression corpus, **not** a sample of real consumers.

## Handling rules

1. Downloaded datasets are untrusted data: never executed, only read and checksummed.
2. Nothing here may be used to claim accuracy on real users.
3. Dataset licences are recorded above; a dataset without a licence is not copied.
4. Real statements/SMS must never be committed. `.gitignore` excludes `.runtime/`.
