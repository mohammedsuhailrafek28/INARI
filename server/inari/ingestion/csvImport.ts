import { createHash } from "node:crypto";
import type { Instrument } from "../../../shared/inari/contracts";
import { parseAmountToPaise } from "../money";
import { InariError } from "../errors";
import { parseCsv } from "./csv";

export type Candidate = {
  rowNumber: number;
  postedOn: string;
  amountPaise: number;
  direction: "debit" | "credit";
  narration: string;
  merchant: string | null;
  instrument: Instrument;
  balanceAfterPaise: number | null;
  reference: string | null;
  isTransfer: boolean;
  /** defaults to "csv" */
  source?: "csv" | "sms";
  /** fingerprint without occurrence index; the index is added by `assignFingerprints` */
  baseKey: string;
  fingerprint: string;
};
export type Rejected = { rowNumber: number; reason: string };
export type CsvParseResult = {
  format: string;
  candidates: Candidate[];
  rejected: Rejected[];
  ignored: Rejected[];
  warnings: string[];
};

const ALIASES = {
  date: ["date", "txn date", "transaction date", "value date", "posting date", "tran date", "booking date", "posted date", "txn. date"],
  narration: ["description", "narration", "particulars", "details", "remarks", "transaction remarks", "transaction details", "payee", "merchant", "memo"],
  debit: ["debit", "withdrawal", "withdrawal amt", "withdrawal amount", "withdrawals", "debit amount", "dr", "paid out", "money out"],
  credit: ["credit", "deposit", "deposit amt", "deposit amount", "deposits", "credit amount", "cr", "paid in", "money in"],
  amount: ["amount", "txn amount", "transaction amount", "amount (inr)", "amount inr", "amt"],
  type: ["type", "dr/cr", "cr/dr", "transaction type", "txn type", "direction", "debit/credit"],
  balance: ["balance", "closing balance", "running balance", "balance (inr)", "available balance"],
  reference: ["ref", "reference", "ref no", "ref no.", "chq/ref no", "chq/refno", "chq./ref.no.", "utr", "cheque no", "reference number", "transaction id"],
} as const;
type Field = keyof typeof ALIASES;

const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/[_\s]+/g, " ").trim();

function mapHeader(cells: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  cells.forEach((cell, index) => {
    const n = norm(cell);
    for (const field of Object.keys(ALIASES) as Field[]) {
      if (map[field] === undefined && (ALIASES[field] as readonly string[]).some(a => norm(a) === n)) map[field] = index;
    }
  });
  return map;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function validDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > dim) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Day-first for ambiguous numeric dates (Indian statements). Returns YYYY-MM-DD or null. */
export function parseDate(input: string): string | null {
  const s = input.trim().replace(/\s+/g, " ");
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T].*)?$/.exec(s);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(s);
  if (m) return validDate(2000 + +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[ /-]([A-Za-z]{3,9})[ ,/-]+(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mon) return null;
    return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], mon, +m[1]);
  }
  return null;
}

function directionFromText(text: string): "debit" | "credit" | null {
  const t = text.trim().toLowerCase();
  if (/^(dr|debit|d|withdrawal|expense|out|debited)\.?$/.test(t)) return "debit";
  if (/^(cr|credit|c|deposit|income|in|credited)\.?$/.test(t)) return "credit";
  return null;
}

export function detectInstrument(narration: string): Instrument {
  const n = narration.toLowerCase();
  if (/\bupi\b/.test(n)) return "upi";
  if (/\bneft\b/.test(n)) return "neft";
  if (/\bimps\b/.test(n)) return "imps";
  if (/\brtgs\b/.test(n)) return "rtgs";
  if (/\batm\b|cash wdl|cash withdrawal/.test(n)) return "atm";
  if (/\b(pos|card|visa|mastercard|rupay)\b/.test(n)) return "card";
  if (/\b(nach|ach|ecs|auto ?debit|mandate|si)\b/.test(n)) return "auto_debit";
  if (/\b(chq|cheque)\b/.test(n)) return "cheque";
  return "other";
}

const NOISE = new Set(["upi", "neft", "imps", "rtgs", "pos", "ach", "nach", "payment", "pay", "txn", "to", "from", "ref", "dr", "cr", "paid", "via", "debit", "credit", "card", "purchase", "transfer"]);

export function extractMerchant(narration: string): string | null {
  // masked card/account numbers (4147XXXXXXXX1234, ****1234) are never merchants
  const cleaned = narration.replace(/\d*[Xx*]{3,}\d*/g, " ");
  const parts = cleaned.split(/[/|]|\s-\s|-(?=[A-Za-z])/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes("@")) continue;
    const letters = part.replace(/[^A-Za-z .&']/g, " ").replace(/\s+/g, " ").trim();
    if (letters.length < 3 || NOISE.has(letters.toLowerCase())) continue;
    const words = letters.split(" ").filter(w => !NOISE.has(w.toLowerCase()));
    if (words.length === 0) continue;
    return words
      .slice(0, 4)
      .map(w => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
      .join(" ");
  }
  return null;
}

const SELF_TRANSFER = /\b(self transfer|own account|to self|sweep (in|out))\b/i;

function normNarration(narration: string) {
  return narration.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

export function baseKeyFor(c: { postedOn: string; amountPaise: number; direction: string; narration: string; reference: string | null }) {
  return [c.postedOn, c.amountPaise, c.direction, normNarration(c.narration), c.reference ?? ""].join("|");
}

/** fingerprint = sha256(owner | base key | occurrence index). Index separates genuinely identical rows within one file. */
export function fingerprintFor(userKey: string, baseKey: string, occurrence: number) {
  return createHash("sha256").update(`${userKey}|${baseKey}|${occurrence}`).digest("hex");
}

export function assignFingerprints(userKey: string, candidates: Candidate[]): void {
  const seen = new Map<string, number>();
  for (const c of candidates) {
    const n = seen.get(c.baseKey) ?? 0;
    seen.set(c.baseKey, n + 1);
    c.fingerprint = fingerprintFor(userKey, c.baseKey, n);
  }
}

export function parseCsvStatement(content: string, opts: { userKey: string; maxRows: number }): CsvParseResult {
  if (!content.trim()) throw new InariError("PARSE_FAILED", "The file is empty.");
  if (content.includes("\u0000")) throw new InariError("UNSUPPORTED_FORMAT", "This does not look like a text CSV file.");
  const { records } = parseCsv(content, { maxRows: opts.maxRows + 50 });

  let headerIndex = -1;
  let cols: Partial<Record<Field, number>> = {};
  for (let i = 0; i < Math.min(records.length, 40); i++) {
    const m = mapHeader(records[i].cells);
    if (m.date !== undefined && (m.amount !== undefined || m.debit !== undefined || m.credit !== undefined)) {
      headerIndex = i;
      cols = m;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new InariError(
      "PARSE_FAILED",
      "Could not find a header row with a date column and amount (or debit/credit) columns. Expected headers such as Date, Description, Debit, Credit or Amount."
    );
  }

  const layout =
    cols.debit !== undefined && cols.credit !== undefined
      ? "debit_credit_columns"
      : cols.amount !== undefined && cols.type !== undefined
        ? "amount_with_type"
        : cols.amount !== undefined
          ? "signed_amount"
          : "single_side_columns";
  const warnings: string[] = [];
  if (cols.narration === undefined) warnings.push("No description column found; merchants cannot be identified.");
  if (headerIndex > 0) warnings.push(`Skipped ${headerIndex} header/preamble line(s) before the column headings.`);

  const candidates: Candidate[] = [];
  const rejected: Rejected[] = [];
  const ignored: Rejected[] = [];
  const cell = (cells: string[], field: Field) => (cols[field] === undefined ? "" : (cells[cols[field]!] ?? "").trim());
  const fileHasNegatives =
    cols.amount !== undefined &&
    records.slice(headerIndex + 1).some(r => {
      const a = parseAmountToPaise(r.cells[cols.amount!] ?? "");
      return !!a && a.ok && a.negative;
    });

  for (const record of records.slice(headerIndex + 1)) {
    const rowNumber = record.line;
    const cells = record.cells;
    const dateText = cell(cells, "date");
    const hasAmountText = [cell(cells, "amount"), cell(cells, "debit"), cell(cells, "credit")].some(v => v !== "");
    if (dateText === "" && !hasAmountText) {
      ignored.push({ rowNumber, reason: "blank or non-transaction line" });
      continue;
    }
    const postedOn = parseDate(dateText);
    if (!postedOn) {
      if (!hasAmountText) ignored.push({ rowNumber, reason: "non-transaction line" });
      else rejected.push({ rowNumber, reason: dateText ? "unrecognised or invalid date" : "missing date" });
      continue;
    }

    let direction: "debit" | "credit" | null = null;
    let paise: number | null = null;
    let problem: string | null = null;

    if (layout === "debit_credit_columns" || layout === "single_side_columns") {
      const d = parseAmountToPaise(cell(cells, "debit"));
      const c = parseAmountToPaise(cell(cells, "credit"));
      if ((d && !d.ok) || (c && !c.ok)) problem = `invalid amount (${((d && !d.ok ? d : c) as { reason: string }).reason})`;
      else {
        const dv = d && d.ok && d.paise > 0 ? d.paise : 0;
        const cv = c && c.ok && c.paise > 0 ? c.paise : 0;
        if (dv && cv) problem = "both debit and credit are filled";
        else if (!dv && !cv) problem = "no amount";
        else {
          direction = dv ? "debit" : "credit";
          paise = dv || cv;
        }
      }
    } else {
      const a = parseAmountToPaise(cell(cells, "amount"));
      if (!a) problem = "missing amount";
      else if (!a.ok) problem = `invalid amount (${a.reason})`;
      else if (a.paise === 0) problem = "zero amount";
      else {
        paise = a.paise;
        const typeText = cols.type !== undefined ? cell(cells, "type") : "";
        const fromType = typeText ? directionFromText(typeText) : null;
        if (typeText && !fromType) problem = "unrecognised debit/credit marker";
        else if (fromType) direction = fromType;
        else if (a.suffix) direction = a.suffix === "dr" ? "debit" : "credit";
        else if (a.negative) direction = "debit";
        else if (fileHasNegatives) direction = "credit"; // signed convention: negative = money out, positive = money in
        else problem = "direction unclear (no negative amounts or Dr/Cr markers in this file)";
      }
    }
    if (problem || direction === null || paise === null) {
      rejected.push({ rowNumber, reason: problem ?? "invalid row" });
      continue;
    }
    if (paise <= 0) {
      rejected.push({ rowNumber, reason: "zero amount" });
      continue;
    }

    const narration = (cell(cells, "narration") || "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!narration) {
      rejected.push({ rowNumber, reason: "missing description" });
      continue;
    }
    const balText = cell(cells, "balance");
    const bal = balText ? parseAmountToPaise(balText) : null;
    const balanceAfterPaise = bal && bal.ok ? (bal.negative || bal.suffix === "dr" ? -bal.paise : bal.paise) : null;
    const reference = cell(cells, "reference") || null;
    const candidate: Candidate = {
      rowNumber,
      postedOn,
      amountPaise: paise,
      direction,
      narration,
      merchant: extractMerchant(narration),
      instrument: detectInstrument(narration),
      balanceAfterPaise,
      reference,
      isTransfer: SELF_TRANSFER.test(narration),
      baseKey: "",
      fingerprint: "",
    };
    candidate.baseKey = baseKeyFor(candidate);
    candidates.push(candidate);
  }
  if (candidates.length + rejected.length > opts.maxRows) {
    throw new InariError("TOO_MANY_ROWS", `The file has more than ${opts.maxRows} transactions. Split it into smaller files.`);
  }
  if (rejected.some(r => r.reason.startsWith("direction unclear"))) {
    warnings.push("The amount column has no negative values or Dr/Cr marker, so debit/credit direction cannot be known; rows were rejected rather than guessed.");
  }
  assignFingerprints(opts.userKey, candidates);
  return { format: `csv:${layout}`, candidates, rejected, ignored, warnings };
}
