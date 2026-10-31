/** Integrity and safety screening of the attributed synthetic SMS corpus. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SMS = path.resolve(__dirname, "../../data/parser-tests/sms");
const raw = readFileSync(path.join(SMS, "indian-payment-sms-dataset.json"));
const corpus = JSON.parse(raw.toString("utf8"));

// The attributed upstream SHA-256 was recorded over CRLF bytes. The committed
// fixture uses LF. Normalize only newline representation for the comparison;
// do not trim, reserialize JSON, change the expected digest, or rewrite the file.
const UPSTREAM_SHA256 = "7a2a912b94c135c366154076985a6b4139971c5be61869f552fad81bd5762360";
const upstreamBytes = (bytes: Buffer) => Buffer.from(bytes.toString("utf8").replace(/\r?\n/g, "\r\n"), "utf8");
const upstreamDigest = (bytes: Buffer) => createHash("sha256").update(upstreamBytes(bytes)).digest("hex");

describe("upstream fixture checksum newline portability", () => {
  it("preserves the original expected upstream hash for LF, CRLF and mixed newlines", () => {
    const lf = Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"));
    const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"));
    const mixed = Buffer.from(lf.toString("utf8").replace("\n", "\r\n"));
    for (const bytes of [lf, crlf, mixed]) expect(upstreamDigest(bytes)).toBe(UPSTREAM_SHA256);
  });

  it("does not hide content edits, whitespace changes, a BOM or a missing final newline", () => {
    const text = raw.toString("utf8").replace(/\r\n/g, "\n");
    expect(upstreamDigest(Buffer.from(text.replace('"synthetic_redacted"', '"tampered"')))).not.toBe(UPSTREAM_SHA256);
    expect(upstreamDigest(Buffer.from(text.replace('  "dataset_name"', ' "dataset_name"')))).not.toBe(UPSTREAM_SHA256);
    expect(upstreamDigest(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), raw]))).not.toBe(UPSTREAM_SHA256);
    expect(text.endsWith("\n")).toBe(true);
    expect(upstreamDigest(Buffer.from(text.slice(0, -1)))).not.toBe(UPSTREAM_SHA256);
  });
});


describe("SMS corpus (CC BY 4.0) integrity", () => {
  it("matches the attributed upstream file modulo LF/CRLF representation", () => {
    expect(upstreamDigest(raw)).toBe(UPSTREAM_SHA256);
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

describe("synthetic demo data is not shaped like real people's identifiers", () => {
  const demoDir = path.resolve(__dirname, "../../data/demo");
  const files = ["fixture_bank_statement.csv", "fixture_debit_credit.csv", "fixture_signed_amount.csv", "labels.csv", "expected.json", "sms_matching_examples.json"];

  it("contains no standalone 10-digit mobile-shaped numbers, and no 12-digit Aadhaar-shaped groups", () => {
    for (const f of files) {
      const text = readFileSync(path.join(demoDir, f), "utf8");
      expect(text.match(/(?<![0-9A-Za-z])[6-9][0-9]{9}(?![0-9])/g) ?? [], f).toEqual([]);
      expect(text.match(/\b[0-9]{4} [0-9]{4} [0-9]{4}\b/g) ?? [], f).toEqual([]);
    }
  });

  it("numeric-looking merchant IDs carry the clearly synthetic prefix", () => {
    const text = readFileSync(path.join(demoDir, "labels.csv"), "utf8");
    const ids = text.match(/[A-Za-z0-9]+@paytm/g) ?? [];
    expect(ids.length).toBeGreaterThan(100);
    for (const id of ids.filter(i => /[0-9]{6}/.test(i))) expect(id.startsWith("demoqr")).toBe(true);
  });
});
