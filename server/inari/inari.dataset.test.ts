/** Integrity + safety screening of the third-party SMS corpus. The SMS parser itself is not implemented yet. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SMS = path.resolve(__dirname, "../../data/parser-tests/sms");
const raw = readFileSync(path.join(SMS, "indian-payment-sms-dataset.json"));
const corpus = JSON.parse(raw.toString("utf8"));

describe("SMS corpus (CC BY 4.0) integrity", () => {
  it("is the verbatim, attributed upstream file", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe("7a2a912b94c135c366154076985a6b4139971c5be61869f552fad81bd5762360");
    expect(readFileSync(path.join(SMS, "LICENSE"), "utf8")).toMatch(/CC BY 4\.0/);
    expect(readFileSync(path.join(SMS, "ATTRIBUTION.md"), "utf8")).toMatch(/SplitEasy/);
    expect(corpus.data_status).toBe("synthetic_redacted");
  });

  it("has the documented shape and label consistency", () => {
    expect(corpus.rows).toHaveLength(172);
    const bookable = corpus.rows.filter((r: any) => r.expected.bookable);
    expect(bookable).toHaveLength(78);
    for (const r of corpus.rows) {
      if (r.expected.bookable) {
        expect(r.expected.transaction_amount_paise).toBeGreaterThan(0);
        expect(["debit", "credit"]).toContain(r.expected.direction);
      } else {
        expect(["upcoming", "declined", "failed", "mandate", "non_financial", "card_bill", "credit", "refund", "reversal"]).toContain(r.kind);
      }
    }
    expect(new Set(corpus.rows.map((r: any) => r.id)).size).toBe(172);
  });

  it("contains no phone numbers or e-mail addresses (PII screen)", () => {
    const text = corpus.rows.map((r: any) => r.raw_sms).join("\n");
    expect(text).not.toMatch(/(?<![\d])[6-9]\d{9}(?![\d])/); // Indian mobile numbers
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
});

describe("synthetic SMS matching examples", () => {
  const examples = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/demo/sms_matching_examples.json"), "utf8")).examples;
  it("state an explicit expected outcome, and uncertain matches are never expected to auto-merge", () => {
    expect(examples.length).toBeGreaterThanOrEqual(5);
    for (const e of examples) expect(["match", "possible_match_needs_review", "no_match", "not_a_transaction"]).toContain(e.expected);
    expect(examples.find((e: any) => e.expected === "possible_match_needs_review")).toBeTruthy();
  });
});
