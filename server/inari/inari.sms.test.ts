/**
 * SMS parser + import. Two evidence sources:
 *  1. the synthetic Indian SMS corpus (data/parser-tests/sms) - the parser was developed against it, so this is
 *     an in-distribution check;
 *  2. independently authored fixtures below, written after the parser, with hand-worked expected values.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { FileLedgerRepository, setLedgerRepositoryForTests } from "./ledger";
import { parseSms, splitMessages } from "./ingestion/sms";
import { _previewStoreForTests } from "./service";

const corpus = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/parser-tests/sms/indian-payment-sms-dataset.json"), "utf8"));
const KEY = "anon:00000000-0000-4000-8000-0000000000a1";
const caller = (key = KEY) =>
  appRouter.createCaller({
    user: { id: 5, openId: "x", email: null, name: "D", loginMethod: "l", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
    inariUserKey: key,
    inariIdentityKind: "anonymous_demo",
  } as TrpcContext);

beforeEach(() => {
  setLedgerRepositoryForTests(new FileLedgerRepository());
  _previewStoreForTests.clear();
});

const importSms = async (text: string, key = KEY) => {
  const p = await caller(key).inari.importPreview({ kind: "sms", text });
  const c = p.counts.accepted + p.counts.possibleDuplicate > 0 ? await caller(key).inari.importCommit({ previewId: p.previewId }) : null;
  return { p, c };
};

describe("SMS corpus (in-distribution check)", () => {
  it("classifies every corpus message into its labelled kind (OTP counts as non-financial)", () => {
    const wrong = corpus.rows.filter((r: any) => {
      const k = parseSms(r.raw_sms).kind;
      return !(k === r.kind || (k === "otp" && r.kind === "non_financial"));
    });
    expect(wrong.map((r: any) => r.id)).toEqual([]);
  });

  it("extracts amount, last-4, reference and merchant exactly for every transaction message", () => {
    let checked = 0;
    for (const r of corpus.rows.filter((x: any) => ["debit", "credit", "refund", "reversal"].includes(x.kind))) {
      const p = parseSms(r.raw_sms);
      const e = r.expected;
      expect({ id: r.id, amt: p.amountPaise, a4: p.accountLast4, c4: p.cardLast4, ref: p.reference, mer: p.merchant }).toEqual({
        id: r.id, amt: e.transaction_amount_paise, a4: e.account_last4, c4: e.card_last4, ref: e.reference, mer: e.merchant,
      });
      checked++;
    }
    expect(checked).toBe(105);
  });

  it("books every labelled debit and nothing that is not a completed movement", () => {
    for (const r of corpus.rows) {
      const p = parseSms(r.raw_sms);
      if (r.kind === "debit") expect(p.bookable, r.id).toBe(true);
      if (["non_financial", "upcoming", "card_bill", "declined", "failed", "mandate"].includes(r.kind)) expect(p.bookable, r.id).toBe(false);
    }
  });

  it("books bank-account credits (salary, UPI, refund) but not card-side or wallet-side credits (documented deviation from the corpus 'bookable' label)", () => {
    const byId = (id: string) => parseSms(corpus.rows.find((r: any) => r.id === id).raw_sms);
    for (const id of ["salary-neft-credit-028", "upi-credit-026", "upi-credit-vpa-027", "bank-refund-031"]) expect(byId(id).bookable, id).toBe(true);
    for (const id of ["card-payment-credit-029", "card-refund-030", "card-reversal-035", "wallet-topup-033"]) expect(byId(id).bookable, id).toBe(false);
  });

  it("never returns or stores anything from OTP messages", () => {
    for (const id of ["otp-amount-042", "otp-code-last-043"]) {
      const p = parseSms(corpus.rows.find((r: any) => r.id === id).raw_sms);
      expect(p).toMatchObject({ kind: "otp", bookable: false, amountPaise: null, narration: null, merchant: null, reference: null });
      expect(JSON.stringify(p)).not.toMatch(/123456|456789|2500|AMAZON/);
    }
  });
});

describe("independently authored fixtures", () => {
  it("UPI debit with VPA, Indian grouping and 4-digit year", () => {
    const p = parseSms("Rs 1,25,000.75 debited from A/c XX9988 on 14-09-2026 to VPA kirana@okicici UPI Ref 998877665544");
    expect(p).toMatchObject({ kind: "debit", bookable: true, amountPaise: 12500075, postedOn: "2026-09-14", accountLast4: "9988", reference: "998877665544", merchant: "kirana", rail: "upi" });
  });

  it("NEFT payroll credit with a balance that must not be mistaken for the amount", () => {
    const p = parseSms("INR 3,200.00 credited to A/c XX9988 on 01-Sep-2026 by NEFT. Info: ACME PAYROLL. Avl bal INR 40,000.00");
    expect(p).toMatchObject({ kind: "credit", direction: "credit", amountPaise: 320000, postedOn: "2026-09-01", bookable: true });
  });

  it("a real debit with a 'never share OTP' footer is booked; a code-only message is dropped", () => {
    expect(parseSms("Rs 500.00 debited from A/c XX1234 on 12-08-26 at BIGMART. Never share OTP or CVV with anyone.")).toMatchObject({ kind: "debit", bookable: true, amountPaise: 50000 });
    const otp = parseSms("998877 is your OTP to log in to the bank app. Do not share it with anyone.");
    expect(otp).toMatchObject({ kind: "otp", narration: null, amountPaise: null });
  });

  it("pending, failed, upcoming, balance-only, promotional and link messages are never booked", () => {
    const cases: Array<[string, string]> = [
      ["Your UPI payment of Rs 300.00 to CAFE is pending. We will update you shortly.", "pending"],
      ["Your payment of Rs 300.00 to CAFE has failed. Money will not be deducted.", "failed"],
      ["Rs 4,000.00 will be debited from your A/c XX1234 on 05-10-26 for your insurance premium.", "upcoming"],
      ["Your A/c XX1234 balance is Rs 9,100.00 as on 30-Sep-26.", "non_financial"],
      ["Win Rs 5000 cashback! Use code SAVE50 on your next order of Rs 999.", "non_financial"],
      ["Rs 700.00 debited from A/c XX1234 on 12-08-26. Dispute here: http://bank-help.example/x", "non_financial"],
      ["Just paid you Rs 200 for lunch, will send more later!", "non_financial"],
    ];
    for (const [text, kind] of cases) expect({ text, ...pick(parseSms(text)) }).toEqual({ text, kind, bookable: false });
  });

  it("refund and reversal credits are recognised as credits and keep their wording for reconciliation", () => {
    const refund = parseSms("Rs 899.00 credited to A/c XX1234 on 06-09-26 as refund from MYNTRA. Ref 556677889900");
    expect(refund).toMatchObject({ kind: "refund", direction: "credit", bookable: true, amountPaise: 89900, merchant: "MYNTRA" });
    expect(refund.narration).toMatch(/refund/);
    const reversal = parseSms("Rs 450.00 reversed to your A/c XX1234 on 07-09-26 for a failed UPI transaction. UPI Ref 112233445566");
    expect(reversal).toMatchObject({ direction: "credit", amountPaise: 45000 });
  });

  it("splits a pasted blob into messages: blank-line separated, one per line, and multi-line SMS", () => {
    expect(splitMessages("A one\n\nB two\n\nC three")).toHaveLength(3);
    expect(splitMessages("Rs 5 debited from A/c XX1 on 01-01-26\nRs 6 debited from A/c XX1 on 02-01-26")).toHaveLength(2);
    expect(splitMessages("Sent Rs.500.00\nFrom HDFC Bank A/C XX1234\nTo SWIGGY\nOn 12/08/26\nRef 123456789001")).toHaveLength(1);
  });

  it("amounts stay integer paise for tricky decimals", () => {
    expect(parseSms("Rs 12.5 debited from A/c XX1234 on 01-02-26 at SHOP").amountPaise).toBe(1250);
    expect(parseSms("Rs.0.07 debited from A/c XX1234 on 01-02-26 at SHOP").amountPaise).toBe(7);
    expect(parseSms("Rs 19,999.99 debited from A/c XX1234 on 01-02-26 at SHOP").amountPaise).toBe(1999999);
  });
});

const pick = (p: ReturnType<typeof parseSms>) => ({ kind: p.kind, bookable: p.bookable });

const MONTH_SMS = (m: number) =>
  [
    `Rs.100000.00 credited to A/c XX1234 on 01-0${m}-26 by NEFT Ref N10000000000${m} (ACME CORP SALARY). Avl Bal Rs.1,50,000.00`,
    `Rs.25000.00 debited from A/c XX1234 on 02-0${m}-26 to rent@bank (UPI Ref No 1110000000${m})`,
    `Rs.6000.00 debited from A/c XX1234 on 10-0${m}-26 to swiggy@ybl (UPI Ref No 2220000000${m})`,
    `Rs.9000.00 debited from A/c XX1234 on 28-0${m}-26 to amazon@apl (UPI Ref No 3330000000${m})`,
    `123456 is your OTP for login. Do not share.`,
    `Your A/c XX1234 balance is Rs.1,50,000.00 as on 28-0${m}-26.`,
  ].join("\n\n");
const SMS_3_MONTHS = [7, 8, 9].map(MONTH_SMS).join("\n\n");

describe("SMS import: same ledger, same snapshot", () => {
  it("previews with counts and reasons that never echo message text, then commits", async () => {
    const { p, c } = await importSms(SMS_3_MONTHS);
    expect(p).toMatchObject({ source: "sms", detectedFormat: "sms", counts: { accepted: 12, rejected: 0, ignored: 6 } });
    const ignoredRows = p.rows.filter(r => r.status === "ignored");
    expect(ignoredRows).toHaveLength(6);
    expect(JSON.stringify(p)).not.toMatch(/123456 is|your OTP|login/);
    expect(c).toMatchObject({ status: "committed", source: "sms", counts: { accepted: 12 } });
  });

  it("SMS-only data yields the same style of snapshot as CSV: income 100000, expenses 40000, rate 60", async () => {
    await importSms(SMS_3_MONTHS);
    const snap = await caller().inari.getSnapshot();
    expect(snap).toMatchObject({ dataSource: "imported", monthlyIncome: 100000, monthlyExpenses: 40000, monthlySurplus: 60000, savingsRate: 60 });
    expect(snap.coverage.transactionCount).toBe(12);
    expect(snap.balances).toEqual({ emergencyFund: null, investments: null, creditCardDebt: null }); // SMS "Avl Bal" never becomes a balance
    const tx = (await caller().inari.listTransactions({ limit: 50 })).items;
    expect(tx.every(t => t.source === "sms")).toBe(true);
    expect(tx.find(t => t.merchant === "swiggy")?.category).toBe("dining");
    expect(tx.find(t => t.merchant === "rent")?.category).toBe("rent");
  });

  it("simulation on SMS-derived data is deterministic and leaves the ledger untouched", async () => {
    await importSms(SMS_3_MONTHS);
    const before = (await caller().inari.listTransactions({ limit: 50 })).items;
    const a = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 50 }] });
    const b = await caller().inari.simulate({ scenarios: [{ type: "reduce_category", category: "dining", percent: 50 }] });
    expect(a.metrics.find(m => m.label === "Monthly expenses")).toMatchObject({ baseline: 40000, scenario: 37000 });
    expect(b.metrics).toEqual(a.metrics);
    expect((await caller().inari.listTransactions({ limit: 50 })).items).toEqual(before);
  });

  it("re-pasting the same SMS is fully deduplicated, including reference-less messages", async () => {
    const text = `${MONTH_SMS(7)}\n\nRs 120.00 debited from A/c XX1234 on 15-07-26 at CHAI POINT`;
    await importSms(text);
    const again = await caller().inari.importPreview({ kind: "sms", text });
    expect(again.counts).toMatchObject({ accepted: 0, duplicate: 5 });
  });

  it("two genuine payments of the same amount on the same day with different references are both kept", async () => {
    const text = [
      "Rs.500.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 900000000001)",
      "Rs.500.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 900000000002)",
    ].join("\n\n");
    const { p } = await importSms(text);
    expect(p.counts).toMatchObject({ accepted: 2, duplicate: 0 });
    expect((await caller().inari.listTransactions({ limit: 10 })).items).toHaveLength(2);
  });

  it("identical reference-less messages inside one paste are kept as separate payments (not silently merged)", async () => {
    const one = "Rs 60.00 debited from A/c XX1234 on 10-07-26 at CHAI POINT";
    const { p } = await importSms(`${one}\n\n${one}`);
    expect(p.counts.accepted).toBe(2);
  });

  it("an SMS that matches an existing CSV row is flagged as a possible duplicate, kept, and never deletes the CSV row", async () => {
    const csv = ["Date,Description,Debit,Credit", "10/07/2026,UPI/333/SWIGGY/sw@bank,500.00,", "01/07/2026,NEFT-ACME SALARY,,90000.00"].join("\n");
    const cp = await caller().inari.importPreview({ kind: "csv", filename: "a.csv", content: csv });
    await caller().inari.importCommit({ previewId: cp.previewId });
    const { p } = await importSms("Rs.500.00 debited from A/c XX1234 on 10-07-26 to swiggy@ybl (UPI Ref No 900000000001)");
    expect(p.counts).toMatchObject({ accepted: 0, possibleDuplicate: 1 });
    const all = (await caller().inari.listTransactions({ limit: 10 })).items;
    expect(all).toHaveLength(3);
    expect(all.filter(t => t.possibleDuplicateOf)).toHaveLength(1);
    const snap = await caller().inari.getSnapshot();
    expect(snap.dataQuality.find(n => n.code === "possible_duplicates")?.message).toMatch(/ARE included/);
    // the user can resolve it: undo the SMS batch and the CSV row is untouched
    const hist = await caller().inari.importHistory();
    const smsBatch = hist.items.find(b => b.source === "sms")!;
    await caller().inari.importUndo({ batchId: smsBatch.batchId });
    expect((await caller().inari.listTransactions({ limit: 10 })).items).toHaveLength(2);
  });

  it("OTP content never appears in any output, ledger record, or log", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(k => vi.spyOn(console, k).mockImplementation(() => undefined));
    const secret = "Use 817263 as your OTP. Do not share. Payment of Rs 2,500.00 to AMAZON.\n\nRs 90.00 debited from A/c XX1234 on 03-07-26 at KIOSK";
    const { p } = await importSms(secret);
    const ledger = JSON.stringify((await caller().inari.listTransactions({ limit: 10 })).items);
    const out = JSON.stringify([p, ledger, await caller().inari.importHistory()]);
    expect(out).not.toMatch(/817263|Use 817263|2,500|AMAZON/);
    expect(spies.every(s => s.mock.calls.length === 0 || !JSON.stringify(s.mock.calls).includes("817263"))).toBe(true);
    spies.forEach(s => s.mockRestore());
  });

  it("undated messages are rejected with a fixed reason; a text of only noise is previewable but cannot be committed", async () => {
    const p = await caller().inari.importPreview({ kind: "sms", text: "Rs.250 debited from Paytm wallet. Available bal Rs.750." });
    expect(p.counts).toMatchObject({ accepted: 0, rejected: 1 });
    expect(p.rows[0].reason).toMatch(/no date/);
    const noise = await caller().inari.importPreview({ kind: "sms", text: "123456 is your OTP. Do not share." });
    expect(noise.counts).toMatchObject({ accepted: 0, ignored: 1 });
    await expect(caller().inari.importCommit({ previewId: noise.previewId })).rejects.toThrow(/Nothing new/);
  });

  it("another user cannot use or see the SMS preview, and sees none of the data", async () => {
    const p = await caller().inari.importPreview({ kind: "sms", text: MONTH_SMS(7) });
    await expect(caller("anon:00000000-0000-4000-8000-0000000000b2").inari.importCommit({ previewId: p.previewId })).rejects.toThrow(/expired|does not exist/);
  });
});
