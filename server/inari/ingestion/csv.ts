import { InariError } from "../errors";

export type CsvRecord = { line: number; cells: string[] };

/** RFC-4180 style parser: quotes, escaped quotes, embedded commas/newlines, BOM, CRLF. Never evaluates content. */
export function parseCsv(input: string, options: { maxRows: number }): { delimiter: string; records: CsvRecord[] } {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let sawContent = false;

  const endRecord = () => {
    cells.push(cell);
    cell = "";
    if (sawContent || cells.some(c => c.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
    sawContent = false;
    if (records.length > options.maxRows) {
      throw new InariError("TOO_MANY_ROWS", `The file has more than ${options.maxRows} rows. Split it into smaller files.`);
    }
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      inQuotes = true;
      sawContent = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
      sawContent = true;
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else if (ch === "\n") {
      endRecord();
      line++;
      recordLine = line;
    } else cell += ch;
  }
  if (inQuotes) throw new InariError("PARSE_FAILED", "The file has an unterminated quoted field.", { line: recordLine });
  if (cell !== "" || cells.length > 0) endRecord();
  return { delimiter, records };
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 15);
  let best = ",";
  let bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = sample.map(l => stripQuoted(l).split(d).length - 1).filter(c => c > 0);
    const score = counts.length === 0 ? 0 : counts.length * 100 + Math.max(...counts);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

const stripQuoted = (line: string) => line.replace(/"[^"]*"/g, "");
