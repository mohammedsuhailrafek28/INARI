#!/usr/bin/env python3
"""
Builds data/demo/sms_matching_examples.json: SYNTHETIC SMS texts that describe a few rows already present in the
demo bank statement (labels.csv), plus decoys. Used later to test cross-source dedupe (SMS vs CSV).
Expected outcome per example is stated explicitly so a matcher can be scored; uncertain ones must stay uncertain.
Deterministic: no randomness.
"""
import csv, json, sys

labels = list(csv.DictReader(open("data/demo/labels.csv", encoding="utf-8")))
pick = lambda needle, n=1: [r for r in labels if needle in r["narration"] and r["direction"] == "debit"][:n]

examples = []
for r in pick("SWIGGY", 1) + pick("BIGBASKET", 1):
    merchant = "SWIGGY" if "SWIGGY" in r["narration"] else "BIGBASKET"
    d, m, y = r["date"][8:10], r["date"][5:7], r["date"][2:4]
    examples.append(dict(
        id=f"match-exact-{r['row_id']}",
        sms=f"Sent Rs.{float(r['amount']):.2f}\\nFrom FICTIONAL BANK A/C XX0000\\nTo {merchant}\\nOn {d}/{m}/{y}\\nNot You? Report it to your bank.",
        csv_row_id=int(r["row_id"]), expected="match", why="same date, amount, direction and merchant",
    ))
r = pick("RAPIDO", 1)[0]
examples.append(dict(
    id=f"match-uncertain-{r['row_id']}",
    sms=f"Rs.{float(r['amount']):.2f} debited from A/C XX0000 on {r['date'][8:10]}/{r['date'][5:7]}/{r['date'][2:4]}. Info: UPI-RAPIDO",
    csv_row_id=int(r["row_id"]), expected="possible_match_needs_review",
    why="amount/date/direction agree but several same-amount rides can exist; must NOT be auto-merged without review"))
r = pick("NETFLIX", 1)[0]
examples.append(dict(
    id="decoy-different-amount",
    sms=f"Sent Rs.{float(r['amount']) + 100:.2f}\\nFrom FICTIONAL BANK A/C XX0000\\nTo NETFLIX\\nOn {r['date'][8:10]}/{r['date'][5:7]}/{r['date'][2:4]}",
    csv_row_id=None, expected="no_match", why="amount differs by Rs 100"))
examples.append(dict(
    id="decoy-future-debit",
    sms="Your a/c XX0000 will be debited Rs.649.00 on 05/10/26 towards NETFLIX mandate.",
    csv_row_id=None, expected="not_a_transaction", why="upcoming mandate, nothing was paid"))

json.dump(dict(note="Synthetic. See data/README.md.", examples=examples), open("data/demo/sms_matching_examples.json", "w", encoding="utf-8", newline="\n"), indent=2)
print(len(examples), "examples")
