#!/usr/bin/env python3
"""
Deterministic generator for a FICTIONAL Indian salaried-professional bank statement (Apr-Sep 2026).

- Pure standard library. Same seed -> byte-identical output (verified by data/generator/check_determinism.py).
- No real person, account or bank data. Merchant names are public brands used only as category vocabulary.
- Written independently; the idea of merchant templates with amount ranges is inspired by
  esaipavan/synthetic-finance-data (MIT), but no code or data is copied from it.

Outputs (into --out):
  fixture_debit_credit.csv     Date,Description,Debit,Credit
  fixture_signed_amount.csv    Date,Narration,Amount            (negative = money out)
  fixture_bank_statement.csv   preamble + Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance + footer
  labels.csv                   row_id,date,narration,direction,amount,category,is_recurring   (EVALUATION ONLY, never a classifier input)
  expected.json                independently computed totals (see "policy" inside)
  MANIFEST.sha256              checksums of every output
"""
import argparse, csv, hashlib, json, random
from calendar import monthrange
from datetime import date

SEED = 20261031
MONTHS = [(2026, m) for m in range(4, 10)]  # Apr..Sep 2026
OPENING_BALANCE_PAISE = 12_000_000  # Rs 1,20,000.00

# category kinds under INARI's documented snapshot policy
INCOME = {"salary", "other_income"}
NEUTRAL = {"investment", "savings", "transfer"}


def paise(rupees):
    return int(round(rupees * 100))


def ref(rng):
    return "".join(str(rng.randint(0, 9)) for _ in range(12))


def upi(rng, merchant, vpa, note="Payment"):
    return f"UPI/{ref(rng)}/{merchant}/{vpa}/{note}"


def build(seed):
    rng = random.Random(seed)
    rows = []  # dicts: day, month tuple, narration, direction, paise, category, recurring

    def add(ym, day, narration, direction, rupees, category, recurring=False):
        last = monthrange(*ym)[1]
        rows.append(dict(ym=ym, day=min(max(day, 1), last), narration=narration, direction=direction,
                         paise=paise(rupees), category=category, recurring=recurring))

    def amt(lo, hi):  # whole-rupee amounts with occasional paise, like real UPI
        v = rng.uniform(lo, hi)
        return round(v) if rng.random() < 0.7 else round(v, 2)

    for idx, ym in enumerate(MONTHS):
        y, m = ym
        # --- fixed monthly commitments (recurring) ---
        add(ym, 1, "NEFT-ACME TECHNOLOGIES PVT LTD-SALARY", "credit", 85000, "salary", True)
        add(ym, 1, "CULT.FIT GYM MEMBERSHIP AUTOPAY", "debit", 1500, "health", True)
        add(ym, 3, upi(rng, "Rent to Landlord", "rajesh.k@oksbi", "House rent"), "debit", 18000, "rent", True)
        add(ym, 5, upi(rng, "NETFLIX", "netflix@icici", "Subscription"), "debit", 649, "subscription", True)
        add(ym, 5, "SIP MUTUAL FUND GROWW ACH DEBIT", "debit", 5000, "investment", True)
        add(ym, 6, "RD INSTALMENT SAVINGS GOAL", "debit", 3000, "savings", True)
        add(ym, 7, upi(rng, "SPOTIFY", "spotify@hdfcbank", "Subscription"), "debit", 119, "subscription", True)
        add(ym, 8, "BESCOM ELECTRICITY BILL PAYMENT", "debit", amt(1800, 3200), "utilities", True)
        add(ym, 10, "ACT FIBERNET BROADBAND", "debit", 1049, "utilities", True)
        add(ym, 12, "AIRTEL POSTPAID BILL", "debit", 599, "utilities", True)
        add(ym, 15, upi(rng, "YOUTUBE PREMIUM", "google@okaxis", "Subscription"), "debit", 129, "subscription", True)
        add(ym, 18, "CREDIT CARD PAYMENT HDFC BANK CARD XX4821", "debit", 4500, "cc_repayment", True)
        add(ym, 20, upi(rng, "APPLE ICLOUD", "apple@icici", "Storage"), "debit", 75, "subscription", True)
        add(ym, 27, "ATM WDL CASH WITHDRAWAL", "debit", 2000, "cash")
        if m in (4, 7):
            add(ym, 9, "LIC PREMIUM POLICY NO XXXX0192", "debit", 2400, "insurance", True)
        if m in (6, 9):
            add(ym, 28, "INTEREST CREDIT SAVINGS A/C", "credit", amt(280, 340), "other_income")

        # --- variable spending ---
        groceries = ["BIGBASKET", "BLINKIT", "ZEPTO", "DMART", "RELIANCE FRESH"]
        for _ in range(rng.randint(9, 11)):
            mer = rng.choice(groceries)
            add(ym, rng.randint(1, 28), upi(rng, mer, mer.lower().replace(" ", "") + "@ybl"), "debit", amt(120, 1100), "groceries")
        dining = ["SWIGGY", "ZOMATO", "STARBUCKS", "BARBEQUE NATION", "DOMINOS PIZZA", "CAFE COFFEE DAY"]
        for _ in range(rng.randint(9, 12)):
            mer = rng.choice(dining)
            add(ym, rng.randint(1, 28), upi(rng, mer, mer.lower().replace(" ", "") + "@icici"), "debit", amt(100, 550), "dining")
        for _ in range(rng.randint(8, 11)):
            mer = rng.choice(["UBER TRIP", "OLA CABS", "RAPIDO", "NAMMA METRO"])
            add(ym, rng.randint(1, 28), upi(rng, mer, mer.split()[0].lower() + "@paytm"), "debit", amt(60, 450), "transport")
        for _ in range(2):
            add(ym, rng.randint(1, 28), f"POS {rng.randint(1000,9999)}XXXXXXXX{rng.randint(1000,9999)} INDIAN OIL PETROL PUMP", "debit", amt(500, 1500), "fuel")
        for _ in range(rng.randint(2, 3)):
            mer = rng.choice(["AMAZON PAY RETAIL", "FLIPKART", "MYNTRA", "NYKAA", "DECATHLON"])
            add(ym, rng.randint(1, 28), f"POS {mer} {rng.randint(100000,999999)}", "debit", amt(300, 2200), "shopping")
        for _ in range(2):
            add(ym, rng.randint(1, 28), upi(rng, "BOOKMYSHOW", "bms@ybl", "Tickets"), "debit", amt(300, 800), "entertainment")
        for _ in range(2):
            add(ym, rng.randint(1, 28), upi(rng, rng.choice(["APOLLO PHARMACY", "MEDPLUS"]), "pharma@ybl"), "debit", amt(150, 900), "health")
        for _ in range(rng.randint(26, 32)):  # UPI micro-payments (tea, snacks, auto)
            mer = rng.choice(["CHAI POINT", "TEA STALL", "SNACK CORNER", "AUTO FARE"])
            add(ym, rng.randint(1, 28), upi(rng, mer, f"demoqr{rng.randint(70000, 99999)}{rng.randint(10000, 99999)}@paytm"), "debit", amt(10, 80), "transport" if mer == "AUTO FARE" else "dining")

    # --- scripted events (exercise anomaly / refund / transfer logic) ---
    add((2026, 7), 14, "POS FLIPKART ELECTRONICS 482910", "debit", 18000, "shopping")      # unusually large purchase
    add((2026, 8), 6, "FLIPKART REFUND ORDER CANCELLED", "credit", 1299, "shopping")      # refund (nets against shopping)
    add((2026, 5), 22, "SELF TRANSFER TO OWN ACCOUNT", "debit", 10000, "transfer")        # neutral
    add((2026, 9), 25, "SELF TRANSFER TO OWN ACCOUNT", "debit", 5000, "transfer")

    rows.sort(key=lambda r: (r["ym"], r["day"], r["category"] not in INCOME, r["narration"]))
    bal = OPENING_BALANCE_PAISE
    for i, r in enumerate(rows, 1):
        bal += r["paise"] if r["direction"] == "credit" else -r["paise"]
        r["row_id"] = i
        r["date"] = date(r["ym"][0], r["ym"][1], r["day"])
        r["balance"] = bal
    return rows


def money(p):
    return f"{p // 100}.{p % 100:02d}"


def indian(p):  # 1,23,456.78
    whole, frac = divmod(p, 100)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return f"{s}.{frac:02d}"


def expected(rows):
    """Independent of INARI: recomputes from the generator's own labels."""
    months = {}
    for r in rows:
        k = f"{r['ym'][0]}-{r['ym'][1]:02d}"
        d = months.setdefault(k, dict(income=0, expenses=0, expenses_excluding_cc_repayment=0, transactions=0))
        d["transactions"] += 1
        c, p, cr = r["category"], r["paise"], r["direction"] == "credit"
        if c in INCOME and cr:
            d["income"] += p
        elif c not in NEUTRAL and c not in INCOME:
            signed = -p if cr else p  # refunds reduce expenses
            d["expenses"] += signed
            if c != "cc_repayment":
                d["expenses_excluding_cc_repayment"] += signed
    last3 = sorted(months)[-3:]
    avg = lambda key: round(sum(months[k][key] for k in last3) / 3)
    inc, exp, exp2 = avg("income"), avg("expenses"), avg("expenses_excluding_cc_repayment")
    rate = lambda i, e: round((i - e) / i * 100, 2)
    return dict(
        policy=("Months are complete calendar months. Average over the last 3 months. Income = salary + other_income credits. "
                "Expenses = debits in expense categories minus credits in expense categories (refunds). investment/savings/transfer are neutral. "
                "A credit-card repayment is counted as an expense by default (INARI cannot see card spending) and flagged as a reconciliation exception."),
        rows=len(rows),
        months={k: {kk: (vv / 100 if kk != 'transactions' else vv) for kk, vv in v.items()} for k, v in sorted(months.items())},
        last_three_months=last3,
        snapshot=dict(monthlyIncome=inc / 100, monthlyExpenses=exp / 100, monthlySurplus=(inc - exp) / 100, savingsRate=rate(inc, exp)),
        snapshot_if_cc_repayment_excluded=dict(monthlyExpenses=exp2 / 100, monthlySurplus=(inc - exp2) / 100, savingsRate=rate(inc, exp2)),
        first_date=str(rows[0]["date"]), last_date=str(rows[-1]["date"]),
    )


def write_all(out, seed):
    import os
    os.makedirs(out, exist_ok=True)
    rows = build(seed)
    dmy = lambda d: d.strftime("%d/%m/%Y")

    with open(f"{out}/fixture_debit_credit.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["Date", "Description", "Debit", "Credit"])
        for r in rows:
            w.writerow([dmy(r["date"]), r["narration"], money(r["paise"]) if r["direction"] == "debit" else "", money(r["paise"]) if r["direction"] == "credit" else ""])

    with open(f"{out}/fixture_signed_amount.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["Date", "Narration", "Amount"])
        for r in rows:
            w.writerow([r["date"].isoformat(), r["narration"], ("-" if r["direction"] == "debit" else "") + money(r["paise"])])

    with open(f"{out}/fixture_bank_statement.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["FICTIONAL BANK LTD - STATEMENT OF ACCOUNT (SYNTHETIC DATA)"])
        w.writerow(["Account No: XXXXXXXX0000", "Customer: SYNTHETIC PROFILE F-01"])
        w.writerow([f"Statement period: {dmy(rows[0]['date'])} to {dmy(rows[-1]['date'])}"])
        w.writerow([])
        w.writerow(["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"])
        for r in rows:
            d = r["date"].strftime("%d/%m/%y")
            w.writerow([d, r["narration"], f"REF{r['row_id']:06d}", d,
                        indian(r["paise"]) if r["direction"] == "debit" else "", indian(r["paise"]) if r["direction"] == "credit" else "", indian(r["balance"])])
        w.writerow([])
        w.writerow(["STATEMENT SUMMARY", f"Closing balance {indian(rows[-1]['balance'])}"])

    with open(f"{out}/labels.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["row_id", "date", "narration", "direction", "amount", "category", "is_recurring"])
        for r in rows:
            w.writerow([r["row_id"], r["date"].isoformat(), r["narration"], r["direction"], money(r["paise"]), r["category"], int(r["recurring"])])

    with open(f"{out}/expected.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(dict(seed=seed, **expected(rows)), f, indent=2, sort_keys=True)
        f.write("\n")

    names = ["fixture_debit_credit.csv", "fixture_signed_amount.csv", "fixture_bank_statement.csv", "labels.csv", "expected.json"]
    with open(f"{out}/MANIFEST.sha256", "w", encoding="utf-8", newline="\n") as f:
        for n in names:
            f.write(f"{hashlib.sha256(open(f'{out}/{n}', 'rb').read()).hexdigest()}  {n}\n")
    return rows


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/demo")
    ap.add_argument("--seed", type=int, default=SEED)
    a = ap.parse_args()
    rows = write_all(a.out, a.seed)
    print(f"wrote {len(rows)} rows to {a.out} (seed {a.seed})")
