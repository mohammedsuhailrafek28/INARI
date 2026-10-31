"""Generates SYNTHETIC bank-statement PDFs used to test PDF ingestion.

Everything here is fictional: the bank names, the account holder, the masked account number and every transaction.
Output goes to data/parser-tests/pdf/ together with expected.json (the transactions each layout must yield).
Deterministic: reportlab runs with invariant=1, so re-running produces byte-identical files.

    python -I -X utf8 data/generator/make_pdf_statements.py
"""
import json
import os
import textwrap

from reportlab.pdfgen import canvas

OUT = "data/parser-tests/pdf"
OPENING = 5_000_000  # paise: 50,000.00

# (date, narration, reference, signed paise: negative = money out)
TXNS = [
    ("2026-08-01", "NEFT CR ACME TECHNOLOGIES SALARY AUG", "N2608010001", 8_500_000),
    ("2026-08-02", "UPI/424242424201/SWIGGY/swiggy@demobank/Food order", "424242424201", -45_000),
    ("2026-08-03", "ATM CASH WDL MAIN ROAD BRANCH SECTOR 5", "ATM000031", -500_000),
    ("2026-08-04", "UPI/424242424202/BIGBASKET/bigbasket@demobank/Groceries weekly order", "424242424202", -128_075),
    ("2026-08-05", "ACH D- NETFLIX ENTERTAINMENT SERVICES INDIA LLP MANDATE", "ACH0005", -64_900),
    ("2026-08-07", "POS 4147XXXXXXXX1234 AMAZON SELLER SERVICES BENGALURU", "POS777001", -349_900),
    ("2026-08-09", "IMPS/P2P/RAHUL VERMA/rent share", "IMPS909001", -1_200_000),
    ("2026-08-10", "UPI/424242424203/ZOMATO/zomato@demobank/Dinner", "424242424203", -89_950),
    ("2026-08-12", "INTEREST CREDITED SAVINGS ACCOUNT", "INT0812", 31_250),
    ("2026-08-14", "UPI/424242424204/UBER INDIA/uber@demobank/Ride", "424242424204", -23_400),
    ("2026-08-14", "UPI/424242424204/UBER INDIA/uber@demobank/Ride", "424242424204", -23_400),
    ("2026-08-16", "NEFT DR LANDLORD A KUMAR HOUSE RENT AUGUST", "N2608160002", -1_800_000),
    ("2026-08-18", "UPI/424242424205/SPOTIFY/spotify@demobank/Premium", "424242424205", -11_900),
    ("2026-08-19", "CHQ DEP CLEARING 000451", "CHQ000451", 250_000),
    ("2026-08-21", "UPI/424242424206/DMART/dmart@demobank/Groceries", "424242424206", -210_050),
    ("2026-08-23", "POS 4147XXXXXXXX1234 RELIANCE DIGITAL MUMBAI", "POS777002", -1_499_900),
    ("2026-08-25", "UPI/424242424207/FRIEND REFUND/friend@demobank/Dinner split", "424242424207", 45_000),
    ("2026-08-27", "ACH D- HDFC LIFE INSURANCE PREMIUM POLICY 77001", "ACH0027", -250_000),
    ("2026-08-28", "UPI/424242424208/PHARMEASY/pharmeasy@demobank/Medicines", "424242424208", -76_025),
    ("2026-08-30", "BIL/BPAY/ELECTRICITY BOARD/AUG BILL", "BPAY0830", -184_300),
    ("2026-08-31", "NEFT CR ACME TECHNOLOGIES REIMBURSEMENT", "N2608310003", 120_000),
    ("2026-09-01", "NEFT CR ACME TECHNOLOGIES SALARY SEP", "N2609010004", 8_500_000),
    ("2026-09-02", "UPI/424242424209/IRCTC/irctc@demobank/Train ticket booking", "424242424209", -135_500),
    ("2026-09-03", "ATM CASH WDL STATION ROAD", "ATM000032", -300_000),
]

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def indian(p: int) -> str:
    rupees, paise = divmod(abs(p), 100)
    s = str(rupees)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return f"{s}.{paise:02d}"


def d_slash(d):  # 05/08/2026
    y, m, dd = d.split("-")
    return f"{dd}/{m}/{y}"


def d_mon(d):  # 05 Aug 2026
    y, m, dd = d.split("-")
    return f"{dd} {MONTHS[int(m) - 1]} {y}"


def d_short(d):  # 05-08-26
    y, m, dd = d.split("-")
    return f"{dd}-{m}-{y[2:]}"


def with_balances():
    bal, rows = OPENING, []
    for d, n, ref, amt in TXNS:
        bal += amt
        rows.append((d, n, ref, amt, bal))
    return rows


ROWS = with_balances()
W, H = 595, 842
TOP, BOTTOM = 770, 70


class Doc:
    def __init__(self, path, bank, total_pages):
        self.c = canvas.Canvas(path, pagesize=(W, H), invariant=1, pageCompression=0)
        self.c.setTitle(f"{bank} synthetic statement")
        self.c.setAuthor("INARI synthetic test data")
        self.bank, self.total, self.page = bank, total_pages, 0

    def new_page(self):
        if self.page:
            self.footer()
            self.c.showPage()
        self.page += 1
        c = self.c
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, 810, f"{self.bank} - Statement of Account (SYNTHETIC DEMO)")
        c.setFont("Helvetica", 8)
        c.drawString(40, 796, "Account holder: DEMO ACCOUNT HOLDER    Account No: XXXXXX1234    Period: 01 Aug 2026 to 03 Sep 2026")
        c.drawString(40, 786, "Fictional document generated for software testing. Not a real bank statement.")

    def footer(self):
        c = self.c
        c.setFont("Helvetica", 7)
        c.drawString(40, 40, "This is a computer generated statement and does not require a signature.")
        c.drawRightString(555, 40, f"Page {self.page} of {self.total}")

    def finish(self):
        self.footer()
        self.c.save()


def wrap(text, width):
    return textwrap.wrap(text, width=width, break_long_words=True, break_on_hyphens=False) or [""]


def layout_a(path, tamper=None):
    """Separate Withdrawal / Deposit / Balance columns, dd/mm/yyyy, repeated header, totals block, 14 rows per page."""
    doc = Doc(path, "Sample Bank A", 2)
    cols = dict(date=40, narr=98, ref=275, wd=392, dep=462, bal=545)

    def header(y):
        c = doc.c
        c.setFont("Helvetica-Bold", 8)
        c.drawString(cols["date"], y, "Date")
        c.drawString(cols["narr"], y, "Narration")
        c.drawString(cols["ref"], y, "Chq/Ref No.")
        c.drawRightString(cols["wd"], y, "Withdrawal Amt.")
        c.drawRightString(cols["dep"], y, "Deposit Amt.")
        c.drawRightString(cols["bal"], y, "Closing Balance")
        c.setFont("Helvetica", 8)

    doc.new_page()
    y = 740
    header(y)
    y -= 16
    c = doc.c
    c.drawString(cols["date"], y, d_slash("2026-08-01"))
    c.drawString(cols["narr"], y, "OPENING BALANCE")
    c.drawRightString(cols["bal"], y, indian(OPENING))
    y -= 14
    on_page = 0
    for d, n, ref, amt, bal in ROWS:
        lines = wrap(n, 28)
        need = 14 + 10 * (len(lines) - 1)
        if on_page >= 14 or y - need < BOTTOM + 40:
            doc.new_page()
            y = 740
            header(y)
            y -= 16
            on_page = 0
        c.drawString(cols["date"], y, d_slash(d))
        c.drawString(cols["narr"], y, lines[0])
        c.drawString(cols["ref"], y, ref)
        shown = amt - 1000 if (tamper == "bad_amount" and ref == "POS777002") else amt  # amount that disagrees with the balance
        c.drawRightString(cols["wd"] if shown < 0 else cols["dep"], y, indian(shown))
        if tamper == "both_columns" and ref == "424242424203":
            c.drawRightString(cols["dep"], y, indian(amt))
        if tamper == "bad_balance" and ref == "POS777002":
            bal += 100_000  # a printed balance that does not follow from the amount
        c.drawRightString(cols["bal"], y, indian(bal))
        for extra in lines[1:]:
            y -= 10
            c.drawString(cols["narr"], y, extra)
        y -= 14
        on_page += 1
    y -= 6
    debits = sum(-a for _, _, _, a, _ in ROWS if a < 0)
    credits = sum(a for _, _, _, a, _ in ROWS if a > 0)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(cols["narr"], y, "TOTAL")
    c.drawRightString(cols["wd"], y, indian(debits))
    c.drawRightString(cols["dep"], y, indian(credits))
    y -= 12
    c.drawString(cols["narr"], y, "CLOSING BALANCE")
    c.drawRightString(cols["bal"], y, indian(ROWS[-1][4]))
    doc.finish()


def layout_b(path, suffix=True, balances=True):
    """One Amount column with Dr/Cr suffix, balance with Cr suffix, 'dd Mon yyyy', header on the first page only."""
    doc = Doc(path, "Sample Bank B", 2)
    cols = dict(date=40, narr=112, ref=300, amt=455, bal=550)
    c = doc.c
    doc.new_page()
    y = 740
    c.setFont("Helvetica-Bold", 8)
    c.drawString(cols["date"], y, "Transaction Date")
    c.drawString(cols["narr"], y, "Particulars")
    c.drawString(cols["ref"], y, "Reference")
    c.drawRightString(cols["amt"], y, "Amount")
    c.drawRightString(cols["bal"], y, "Balance")
    c.setFont("Helvetica", 8)
    y -= 16
    c.drawString(cols["date"], y, d_mon("2026-08-01"))
    c.drawString(cols["narr"], y, "Opening Balance")
    if balances:
        c.drawRightString(cols["bal"], y, indian(OPENING) + " Cr")
    y -= 14
    on_page = 0
    for d, n, ref, amt, bal in ROWS:
        lines = wrap(n, 32)
        need = 14 + 10 * (len(lines) - 1)
        if on_page >= 15 or y - need < BOTTOM + 40:
            doc.new_page()
            y = 745  # no repeated table header on this layout
            on_page = 0
        c.drawString(cols["date"], y, d_mon(d))
        c.drawString(cols["narr"], y, lines[0])
        c.drawString(cols["ref"], y, ref)
        if suffix:
            c.drawRightString(cols["amt"], y, indian(amt) + (" Cr" if amt > 0 else " Dr"))
        else:
            c.drawRightString(cols["amt"], y, indian(amt))
        if balances:
            c.drawRightString(cols["bal"], y, indian(bal) + " Cr")
        for extra in lines[1:]:
            y -= 10
            c.drawString(cols["narr"], y, extra)
        y -= 14
        on_page += 1
    y -= 6
    c.setFont("Helvetica-Bold", 8)
    c.drawString(cols["narr"], y, "Statement summary")
    y -= 12
    c.setFont("Helvetica", 8)
    c.drawString(cols["narr"], y, "Total debits")
    c.drawRightString(cols["amt"], y, indian(sum(-a for _, _, _, a, _ in ROWS if a < 0)))
    y -= 11
    c.drawString(cols["narr"], y, "Total credits")
    c.drawRightString(cols["amt"], y, indian(sum(a for _, _, _, a, _ in ROWS if a > 0)))
    doc.finish()


def layout_c(path):
    """Newest first, Type column (DR/CR), plain amounts, dd-mm-yy, header repeated on every page."""
    doc = Doc(path, "Sample Bank C", 2)
    cols = dict(date=40, narr=100, typ=372, amt=450, bal=545)
    c = doc.c

    def header(y):
        c.setFont("Helvetica-Bold", 8)
        c.drawString(cols["date"], y, "Txn Date")
        c.drawString(cols["narr"], y, "Description")
        c.drawString(cols["typ"], y, "Dr/Cr")
        c.drawRightString(cols["amt"], y, "Amount (INR)")
        c.drawRightString(cols["bal"], y, "Balance (INR)")
        c.setFont("Helvetica", 8)

    doc.new_page()
    y = 740
    header(y)
    y -= 16
    on_page = 0
    for d, n, ref, amt, bal in reversed(ROWS):
        lines = wrap(n, 44)
        need = 14 + 10 * (len(lines) - 1)
        if on_page >= 15 or y - need < BOTTOM + 40:
            doc.new_page()
            y = 740
            header(y)
            y -= 16
            on_page = 0
        c.drawString(cols["date"], y, d_short(d))
        c.drawString(cols["narr"], y, lines[0])
        c.drawString(cols["typ"], y, "CR" if amt > 0 else "DR")
        c.drawRightString(cols["amt"], y, indian(amt))
        c.drawRightString(cols["bal"], y, indian(bal))
        for extra in lines[1:]:
            y -= 10
            c.drawString(cols["narr"], y, extra)
        y -= 14
        on_page += 1
    c.drawString(cols["date"], y, d_short("2026-08-01"))
    c.drawString(cols["narr"], y, "Opening Balance")
    c.drawRightString(cols["bal"], y, indian(OPENING))
    doc.finish()


def scanned(path):
    """A page that holds only a bitmap (no text layer): what a scanned statement looks like."""
    import fitz

    pix = fitz.Pixmap(fitz.csGRAY, fitz.IRect(0, 0, 120, 160), False)
    pix.set_rect(pix.irect, (235,))
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    page.insert_image(fitz.Rect(40, 60, 520, 700), pixmap=pix)
    doc.set_metadata({})
    doc.save(path, garbage=0, deflate=False)


def encrypted(src, path):
    from pypdf import PdfReader, PdfWriter

    w = PdfWriter(clone_from=PdfReader(src))
    w.encrypt("demo-pass", algorithm="RC4-128")
    with open(path, "wb") as f:
        w.write(f)


def many_pages(path, n):
    c = canvas.Canvas(path, pagesize=(W, H), invariant=1, pageCompression=0)
    for i in range(n):
        c.setFont("Helvetica", 8)
        c.drawString(40, 800, f"Page {i + 1} synthetic filler")
        c.showPage()
    c.save()


def letter(path):
    """Selectable text but no transaction table: a covering letter, not a statement."""
    c = canvas.Canvas(path, pagesize=(W, H), invariant=1, pageCompression=0)
    c.setFont("Helvetica", 10)
    c.drawString(60, 760, "Dear customer, this letter explains our new fee schedule (synthetic text).")
    c.drawString(60, 745, "Nothing in this document is a list of transactions.")
    c.showPage()
    c.save()


def expected():
    return [
        {"postedOn": d, "amountPaise": abs(a), "direction": "debit" if a < 0 else "credit", "reference": ref, "balanceAfterPaise": bal, "narration": n}
        for d, n, ref, a, bal in ROWS
    ]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    layout_a(f"{OUT}/layout_a_debit_credit_columns.pdf")
    layout_b(f"{OUT}/layout_b_amount_drcr_suffix.pdf")
    layout_c(f"{OUT}/layout_c_type_column_newest_first.pdf")
    layout_a(f"{OUT}/variant_bad_running_balance.pdf", tamper="bad_balance")
    layout_a(f"{OUT}/variant_debit_and_credit_both_filled.pdf", tamper="both_columns")
    layout_a(f"{OUT}/variant_amount_disagrees_with_balance.pdf", tamper="bad_amount")
    layout_b(f"{OUT}/variant_amount_without_marker.pdf", suffix=False)
    layout_b(f"{OUT}/variant_amount_without_marker_or_balance.pdf", suffix=False, balances=False)
    scanned(f"{OUT}/scanned_image_only.pdf")
    encrypted(f"{OUT}/layout_a_debit_credit_columns.pdf", f"{OUT}/layout_a_encrypted.pdf")
    many_pages(f"{OUT}/too_many_pages.pdf", 61)
    letter(f"{OUT}/text_without_table.pdf")
    with open(f"{OUT}/expected.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump({"openingBalancePaise": OPENING, "transactions": expected()}, f, indent=2)
        f.write("\n")
    print("wrote", sorted(os.listdir(OUT)))
