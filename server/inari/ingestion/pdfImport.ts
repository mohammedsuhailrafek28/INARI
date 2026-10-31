/**
 * Bank-statement PDF ingestion for digitally generated (text-selectable) statements.
 *
 * What it does: reads the PDF's text layer with pdfjs, rebuilds table rows from text positions, locates the table
 * header on each page, and turns rows into the same `Candidate` records the CSV and SMS importers produce.
 *
 * What it does NOT do: OCR. A PDF without a text layer is refused (SCANNED_PDF_UNSUPPORTED).
 *
 * Safety rules enforced here:
 *  - The PDF bytes and extracted text are never logged, stored or sent anywhere; only structured candidates leave.
 *  - Error messages are fixed phrases and never echo statement text.
 *  - Size, page, text-item and row limits apply; encrypted files need the user's password and it is never retained.
 *  - Money is integer paise. A row whose debit/credit direction is unknown is rejected, not guessed.
 *  - Summary lines (totals, opening/closing balance) are never imported as transactions.
 */
import { createRequire } from "node:module";
import { InariError } from "../errors";
import { parseAmountToPaise } from "../money";
import {
  assignFingerprints, baseKeyFor, detectInstrument, extractMerchant, mapHeader, parseDate, SELF_TRANSFER,
  type Candidate, type CsvParseResult, type Rejected,
} from "./csvImport";

export const PDF_LIMITS = { maxBytes: 5_000_000, maxPages: 60, maxTextItems: 150_000, timeoutMs: 20_000 } as const;

export type PdfCell = { text: string; x0: number; x1: number };
export type PdfLine = { page: number; line: number; y: number; size: number; pageHeight: number; cells: PdfCell[] };

type RawItem = { str: string; x: number; y: number; w: number; h: number };

const fail = (code: ConstructorParameters<typeof InariError>[0], message: string): never => {
  throw new InariError(code, message);
};

/* ------------------------------------------------------------------ text extraction */

function decodeBase64(b64: string): Buffer {
  const clean = b64.replace(/\s+/g, "");
  if (clean.length === 0) return fail("PARSE_FAILED", "The file is empty.");
  if (clean.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    return fail("UNSUPPORTED_FORMAT", "The PDF content is not valid base64.");
  }
  return Buffer.from(clean, "base64");
}

function groupIntoLines(items: RawItem[], page: number, pageHeight: number): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; size: number; items: RawItem[] }[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(1.5, 0.3 * Math.max(it.h, last.size))) {
      last.items.push(it);
      last.size = Math.max(last.size, it.h);
    } else rows.push({ y: it.y, size: it.h, items: [it] });
  }
  return rows.map((row, i) => {
    const byX = row.items.sort((a, b) => a.x - b.x);
    const cells: PdfCell[] = [];
    for (const it of byX) {
      const prev = cells[cells.length - 1];
      const gap = prev ? it.x - prev.x1 : Infinity;
      if (prev && gap <= 0.6 * Math.max(row.size, 4)) {
        prev.text += (gap > 0.15 * Math.max(row.size, 4) ? " " : "") + it.str;
        prev.x1 = it.x + it.w;
      } else cells.push({ text: it.str, x0: it.x, x1: it.x + it.w });
    }
    return {
      page, line: i + 1, y: row.y, size: row.size, pageHeight,
      cells: cells.map(c => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() })).filter(c => c.text !== ""),
    };
  }).filter(l => l.cells.length > 0).map((l, i) => ({ ...l, line: i + 1 }));
}

export async function extractPdfLines(bytes: Buffer, password?: string): Promise<{ pages: number; lines: PdfLine[] }> {
  if (bytes.length === 0) fail("PARSE_FAILED", "The file is empty.");
  if (bytes.length > PDF_LIMITS.maxBytes) fail("FILE_TOO_LARGE", "The PDF is larger than 5 MB. Export a shorter period.");
  if (!bytes.subarray(0, 1024).includes("%PDF-")) fail("UNSUPPORTED_FORMAT", "This does not look like a PDF file.");

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fontDir = createRequire(import.meta.url).resolve("pdfjs-dist/package.json").replace(/package\.json$/, "standard_fonts/");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    password: password || undefined,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0,
    standardFontDataUrl: fontDir,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = (async () => {
      const doc = await task.promise;
      if (doc.numPages > PDF_LIMITS.maxPages) {
        fail("FILE_TOO_LARGE", `The PDF has more than ${PDF_LIMITS.maxPages} pages. Export a shorter period.`);
      }
      const lines: PdfLine[] = [];
      let count = 0;
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const pageHeight = page.view[3] - page.view[1];
        const content = await page.getTextContent();
        const items: RawItem[] = [];
        for (const raw of content.items) {
          if (!("str" in raw) || raw.str.trim() === "") continue;
          if (++count > PDF_LIMITS.maxTextItems) fail("FILE_TOO_LARGE", "The PDF contains too much text to process safely.");
          items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], w: raw.width, h: raw.height || Math.abs(raw.transform[3]) });
        }
        lines.push(...groupIntoLines(items, p, pageHeight));
        page.cleanup();
      }
      return { pages: doc.numPages, lines };
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new InariError("PARSE_FAILED", "Reading the PDF took too long and was stopped.")), PDF_LIMITS.timeoutMs);
    });
    work.catch(() => undefined); // a late failure after the timeout must not surface as an unhandled rejection
    const result = await Promise.race([work, timeout]);
    if (result.lines.length === 0) {
      fail("SCANNED_PDF_UNSUPPORTED", "This PDF has no selectable text (it looks scanned). Scanned statements are not supported; download the digital statement from your bank or use CSV.");
    }
    return result;
  } catch (error) {
    if (error instanceof InariError) throw error;
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") {
      const wrong = (error as { code?: number }).code === 2;
      return fail("PASSWORD_REQUIRED", wrong ? "The PDF password is incorrect." : "This PDF is password-protected. Enter its password to import it.");
    }
    return fail("PARSE_FAILED", "The PDF could not be read. It may be damaged or use an unsupported structure.");
  } finally {
    if (timer) clearTimeout(timer);
    void task.destroy().catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ layout recognition */

type Field = "date" | "narration" | "debit" | "credit" | "amount" | "type" | "balance" | "reference";
type Column = { field: Field | null; x0: number; x1: number; numeric: boolean };

const NUMERIC_FIELDS = new Set<Field>(["debit", "credit", "amount", "balance"]);
const SUMMARY = /\b(opening balance|closing balance|brought forward|carried forward|b\/f|c\/f|total|summary|grand total|statement of)\b/i;
const OPENING = /^(opening balance|brought forward|balance b\/f|b\/f)\b/i;
const FURNITURE = /(page\s+\d+\s*(of|\/)\s*\d+|computer[- ]generated|does not require|system generated|customer care|registered office|continued)/i;

function headerColumns(cells: PdfCell[]): Column[] | null {
  const map = mapHeader(cells.map(c => c.text));
  if (map.date === undefined || (map.amount === undefined && map.debit === undefined && map.credit === undefined)) return null;
  const fieldAt = new Map<number, Field>();
  for (const [field, index] of Object.entries(map) as [Field, number][]) fieldAt.set(index, field);
  return cells.map((c, i) => {
    const field = fieldAt.get(i) ?? null;
    return { field, x0: c.x0, x1: c.x1, numeric: field !== null && NUMERIC_FIELDS.has(field) };
  });
}

type Amount = { paise: number; negative: boolean; suffix: "dr" | "cr" | null };

function asAmount(text: string): Amount | null {
  if (!text.includes(".") && !/\b(dr|cr)\b\.?$/i.test(text)) return null;
  const a = parseAmountToPaise(text);
  return a && a.ok ? { paise: a.paise, negative: a.negative, suffix: a.suffix } : null;
}

/** A lone "Dr"/"Cr" cell printed just after a number belongs to that number. */
function joinMarkers(cells: PdfCell[]): PdfCell[] {
  const out: PdfCell[] = [];
  for (const c of cells) {
    const prev = out[out.length - 1];
    if (prev && /^(dr|cr)\.?$/i.test(c.text) && asAmount(prev.text) && c.x0 - prev.x1 < 15) {
      prev.text += ` ${c.text}`;
      prev.x1 = c.x1;
    } else out.push({ ...c });
  }
  return out;
}

const distance = (c: PdfCell, col: Column) => Math.min(Math.abs(c.x1 - col.x1), Math.abs(c.x0 - col.x0), Math.abs((c.x0 + c.x1) / 2 - (col.x0 + col.x1) / 2));

type Assigned = {
  text: Partial<Record<Field, string>>;
  amounts: Partial<Record<"debit" | "credit" | "amount" | "balance", Amount>>;
  problems: string[];
  /** true when every text cell sits in the narration/reference area (a wrapped description line) */
  onlyNarration: boolean;
};

function assignCells(cells: PdfCell[], cols: Column[]): Assigned {
  const out: Assigned = { text: {}, amounts: {}, problems: [], onlyNarration: true };
  const numericCols = cols.filter(c => c.numeric);
  for (const cell of joinMarkers(cells)) {
    const amount = numericCols.length ? asAmount(cell.text) : null;
    if (amount) {
      out.onlyNarration = false;
      const ranked = numericCols.map(col => ({ col, d: distance(cell, col) })).sort((a, b) => a.d - b.d);
      if (ranked.length > 1 && ranked[1].d - ranked[0].d < 1) {
        out.problems.push("amount column is ambiguous");
        continue;
      }
      const field = ranked[0].col.field as "debit" | "credit" | "amount" | "balance";
      if (out.amounts[field]) out.problems.push("two values in one amount column");
      else out.amounts[field] = amount;
      continue;
    }
    // text cell: the last column whose left edge is at or before the cell's left edge (3pt tolerance)
    let col: Column | null = null;
    for (const c of cols) if (c.x0 - 3 <= cell.x0) col = c;
    if (!col) continue; // left of the table: margin text
    if (col.numeric) {
      if (!/^(-+|nil|n\/a|0+(\.0+)?)$/i.test(cell.text)) out.problems.push("unexpected text in an amount column");
      continue;
    }
    if (col.field === null) {
      out.onlyNarration = false;
      continue;
    }
    if (col.field !== "narration" && col.field !== "reference") out.onlyNarration = false;
    out.text[col.field] = out.text[col.field] ? `${out.text[col.field]} ${cell.text}` : cell.text;
  }
  return out;
}

const dirFromType = (t: string): "debit" | "credit" | null => {
  const s = t.trim().toLowerCase().replace(/\.$/, "");
  if (/^(dr|debit|d|withdrawal|w)$/.test(s)) return "debit";
  if (/^(cr|credit|c|deposit)$/.test(s)) return "credit";
  return null;
};

/* ------------------------------------------------------------------ statement parsing */

type Row = {
  rowNumber: number;
  page: number;
  line: number;
  postedOn: string;
  narration: string;
  reference: string | null;
  paise: number;
  direction: "debit" | "credit" | null;
  balance: number | null;
  lastY: number;
  size: number;
  /** rejected row kept only so its printed balance can anchor the next row's check */
  skip?: boolean;
};

export async function parsePdfStatement(
  contentBase64: string,
  opts: { userKey: string; maxRows: number; password?: string }
): Promise<CsvParseResult> {
  const bytes = decodeBase64(contentBase64);
  const { lines } = await extractPdfLines(bytes, opts.password);

  let cols: Column[] | null = null;
  let layoutFields = new Set<Field>();
  const rows: Row[] = [];
  const rejected: Rejected[] = [];
  const ignored: Rejected[] = [];
  let opening: number | null = null;
  let orphanLines = 0;
  let sawMarker = false;
  let rowCounter = 0;

  for (const line of lines) {
    rowCounter++;
    const header = headerColumns(line.cells);
    if (header) {
      cols = header;
      layoutFields = new Set(header.map(c => c.field).filter((f): f is Field => f !== null));
      continue;
    }
    if (!cols) continue; // account details above the first table header
    const nearEdge = line.y > line.pageHeight * 0.93 || line.y < line.pageHeight * 0.07;
    const text = line.cells.map(c => c.text).join(" ");
    if (nearEdge || FURNITURE.test(text)) continue; // repeated page header/footer text

    const a = assignCells(line.cells, cols);
    const dateText = a.text.date ?? "";
    const postedOn = dateText ? parseDate(dateText) : null;
    const narration = (a.text.narration ?? "").trim();
    const hasAmount = Object.keys(a.amounts).length > 0;

    if (!postedOn) {
      const prev = rows[rows.length - 1];
      if (hasAmount || (SUMMARY.test(text) && !dateText)) {
        ignored.push({ rowNumber: rowCounter, reason: "summary or balance line, not a transaction" });
        continue;
      }
      if (prev && !dateText && a.onlyNarration && a.problems.length === 0 && prev.page === line.page && prev.lastY - line.y <= 2.0 * Math.max(prev.size, line.size)) {
        const join = /[/\-@]$/.test(prev.narration) ? "" : " ";
        prev.narration = `${prev.narration}${join}${narration}`.slice(0, 300);
        if (a.text.reference) prev.reference = `${prev.reference ?? ""}${a.text.reference}`;
        prev.lastY = line.y;
        continue;
      }
      orphanLines++;
      continue;
    }

    // dated line
    if (OPENING.test(narration) || /^(closing balance|carried forward|c\/f)\b/i.test(narration)) {
      if (OPENING.test(narration) && opening === null && a.amounts.balance) {
        const b = a.amounts.balance;
        opening = b.negative || b.suffix === "dr" ? -b.paise : b.paise;
      }
      ignored.push({ rowNumber: rowCounter, reason: "opening/closing balance line, not a transaction" });
      continue;
    }
    if (SUMMARY.test(narration) && !hasAmount) {
      ignored.push({ rowNumber: rowCounter, reason: "summary line, not a transaction" });
      continue;
    }
    if (a.problems.length > 0) {
      rejected.push({ rowNumber: rowCounter, reason: a.problems[0] });
      continue;
    }
    if (!narration) {
      rejected.push({ rowNumber: rowCounter, reason: "missing description" });
      continue;
    }

    let paise: number | null = null;
    let direction: "debit" | "credit" | null = null;
    let problem: string | null = null;
    const { debit, credit, amount, balance } = a.amounts;
    if (layoutFields.has("debit") || layoutFields.has("credit")) {
      const dv = debit && debit.paise > 0 ? debit.paise : 0;
      const cv = credit && credit.paise > 0 ? credit.paise : 0;
      if (dv && cv) problem = "both debit and credit are filled";
      else if (!dv && !cv) problem = "no amount";
      else {
        paise = dv || cv;
        direction = dv ? "debit" : "credit";
      }
    } else if (amount) {
      if (amount.paise === 0) problem = "zero amount";
      else {
        paise = amount.paise;
        const fromType = a.text.type ? dirFromType(a.text.type) : null;
        if (a.text.type && !fromType) problem = "unrecognised debit/credit marker";
        else if (fromType) direction = fromType;
        else if (amount.suffix) direction = amount.suffix === "dr" ? "debit" : "credit";
        else if (amount.negative) direction = "debit";
        if (amount.suffix) sawMarker = true;
      }
    } else problem = "no amount";
    if (problem || paise === null) {
      rejected.push({ rowNumber: rowCounter, reason: problem ?? "invalid row" });
      if (balance) {
        rows.push({
          rowNumber: rowCounter, page: line.page, line: line.line, postedOn, narration: "", reference: null, paise: 0, direction: null,
          balance: balance.negative || balance.suffix === "dr" ? -balance.paise : balance.paise, lastY: line.y, size: line.size, skip: true,
        });
      }
      continue;
    }
    rows.push({
      rowNumber: rowCounter, page: line.page, line: line.line, postedOn,
      narration: narration.slice(0, 300), reference: a.text.reference ?? null, paise, direction,
      balance: balance ? (balance.negative || balance.suffix === "dr" ? -balance.paise : balance.paise) : null,
      lastY: line.y, size: line.size,
    });
  }

  if (!cols) {
    fail("UNSUPPORTED_FORMAT", "No transaction table was recognised. Supported layouts have a header row with a date column and either Debit/Credit (Withdrawal/Deposit) columns or an Amount column.");
  }
  const warnings: string[] = [];

  /* ---- order and running-balance validation ---- */
  const consistent = (seq: Row[]) => {
    let ok = 0;
    for (let i = 1; i < seq.length; i++) {
      const p = seq[i - 1], c = seq[i];
      if (p.balance === null || c.balance === null || c.direction === null) continue;
      if (p.balance + (c.direction === "credit" ? c.paise : -c.paise) === c.balance) ok++;
    }
    return ok;
  };
  const reversed = [...rows].reverse();
  const asc = consistent(rows), desc = consistent(reversed);
  const datesDesc = rows.length > 1 && rows[0].postedOn > rows[rows.length - 1].postedOn;
  const newestFirst = desc > asc || (desc === asc && datesDesc);
  const chrono = newestFirst ? reversed : rows;
  if (newestFirst) warnings.push("Rows are listed newest first; they were read in reverse order.");

  const rejectedRows = new Set<number>();
  let prev: number | null = opening;
  let checked = 0, mismatched = 0, inferred = 0;
  let balanceOnly = 0;
  for (let i = 0; i < chrono.length; i++) {
    const r = chrono[i];
    const next = chrono[i + 1];
    if (r.skip) {
      prev = r.balance;
      continue;
    }
    if (r.direction === null) {
      if (prev !== null && r.balance !== null && r.balance - prev === r.paise) r.direction = "credit";
      else if (prev !== null && r.balance !== null && prev - r.balance === r.paise) r.direction = "debit";
      if (r.direction) inferred++;
      else {
        rejected.push({ rowNumber: r.rowNumber, reason: "debit/credit direction is unclear (no marker, and the running balance does not settle it)" });
        rejectedRows.add(r.rowNumber);
        prev = r.balance;
        continue;
      }
    }
    if (r.balance !== null && prev !== null) {
      checked++;
      const expected = prev + (r.direction === "credit" ? r.paise : -r.paise);
      if (expected !== r.balance) {
        // If the NEXT row continues correctly from this row's expected balance, only this row's printed balance is
        // off: keep the transaction (its amount is corroborated) but do not trust the printed balance.
        const nextFits = !!next && next.direction !== null && next.balance !== null && expected + (next.direction === "credit" ? next.paise : -next.paise) === next.balance;
        if (nextFits) {
          r.balance = null;
          balanceOnly++;
        } else {
          mismatched++;
          rejected.push({ rowNumber: r.rowNumber, reason: "running balance does not reconcile with the previous balance and this amount" });
          rejectedRows.add(r.rowNumber);
        }
      }
    }
    prev = r.balance ?? (prev !== null ? prev + (r.direction === "credit" ? r.paise : -r.paise) : null);
  }
  if (checked === 0 && rows.length > 0) {
    warnings.push("Running balances were not available to cross-check amounts and directions; review the preview carefully.");
  }
  if (mismatched > 0) warnings.push(`${mismatched} row(s) did not match the running balance and were rejected instead of guessed.`);
  if (balanceOnly > 0) warnings.push(`${balanceOnly} row(s) had a printed balance that does not follow from the amounts; the transaction was kept and that balance was ignored.`);
  if (inferred > 0) warnings.push(`${inferred} row(s) had no Dr/Cr marker; their direction was derived from the running balance.`);
  if (orphanLines > 0) warnings.push(`${orphanLines} text line(s) between rows could not be attached to a transaction and were skipped.`);
  if (opening === null) warnings.push("No opening balance line was found, so the first row's balance was not cross-checked.");

  const candidates: Candidate[] = chrono.filter(r => !r.skip && !rejectedRows.has(r.rowNumber)).map(r => {
    const narration = r.narration.replace(/\s+/g, " ").trim();
    const c: Candidate = {
      rowNumber: r.rowNumber,
      postedOn: r.postedOn,
      amountPaise: r.paise,
      direction: r.direction as "debit" | "credit",
      narration,
      merchant: extractMerchant(narration),
      instrument: detectInstrument(narration),
      balanceAfterPaise: r.balance,
      reference: r.reference,
      isTransfer: SELF_TRANSFER.test(narration),
      source: "pdf",
      evidence: { page: r.page, line: r.line },
      baseKey: "",
      fingerprint: "",
    };
    c.baseKey = baseKeyFor(c);
    return c;
  });
  if (candidates.length + rejected.length > opts.maxRows) {
    fail("TOO_MANY_ROWS", `The file has more than ${opts.maxRows} transactions. Split it into smaller files.`);
  }
  assignFingerprints(opts.userKey, candidates);

  const layout =
    layoutFields.has("debit") || layoutFields.has("credit")
      ? "debit_credit_columns"
      : layoutFields.has("type")
        ? "amount_type_column"
        : sawMarker
          ? "amount_dr_cr_suffix"
          : "amount_balance_derived";
  return { format: `pdf:${layout}`, candidates, rejected: rejected.sort((a, b) => a.rowNumber - b.rowNumber), ignored, warnings };
}
