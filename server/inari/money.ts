/**
 * Integer-paise money handling. No floating point is used to parse or add amounts.
 * Supported inputs: "1,23,456.78", "1,234,567.89", "₹ 500", "Rs. 500.5", "INR 500", "(500.00)", "-500", "500 Dr", "500 CR".
 */
export const MAX_PAISE = 9_000_000_000_000; // ₹90 billion; anything above is rejected as implausible

export type ParsedAmount =
  | { ok: true; paise: number; negative: boolean; suffix: "dr" | "cr" | null }
  | { ok: false; reason: string };

const INDIAN_GROUPING = /^\d{1,2}(,\d{2})*,\d{3}$/; // 12,34,567
const WESTERN_GROUPING = /^\d{1,3}(,\d{3})+$/; // 1,234,567

export function parseAmountToPaise(input: string | null | undefined): ParsedAmount | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim();
  if (s === "" || s === "-" || s === "--") return null;

  let negative = false;
  let suffix: "dr" | "cr" | null = null;

  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1].trim();
  }
  const suf = /\s*(dr|cr|debit|credit)\.?$/i.exec(s);
  if (suf) {
    suffix = suf[1].toLowerCase().startsWith("d") ? "dr" : "cr";
    s = s.slice(0, suf.index).trim();
  }
  s = s.replace(/^(₹|rs\.?|inr)\s*/i, "").trim();
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    s = s.slice(1).trim();
  }
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(/^(₹|rs\.?|inr)\s*/i, "").trim();

  const [whole, frac = "", ...extra] = s.split(".");
  if (extra.length > 0) return { ok: false, reason: "invalid number" };
  if (!/^[\d,]+$/.test(whole) || (frac !== "" && !/^\d+$/.test(frac))) return { ok: false, reason: "invalid number" };
  if (whole.includes(",") && !(INDIAN_GROUPING.test(whole) || WESTERN_GROUPING.test(whole))) {
    return { ok: false, reason: "invalid digit grouping" };
  }
  if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) return { ok: false, reason: "more than 2 decimal places" };

  const digits = whole.replace(/,/g, "");
  if (digits === "") return { ok: false, reason: "invalid number" };
  const paiseStr = `${digits}${(frac + "00").slice(0, 2)}`;
  if (paiseStr.length > 15) return { ok: false, reason: "amount too large" };
  const paise = Number(paiseStr);
  if (!Number.isSafeInteger(paise) || paise > MAX_PAISE) return { ok: false, reason: "amount too large" };
  return { ok: true, paise, negative, suffix };
}

export const paiseToRupees = (paise: number) => paise / 100; // exact for |paise| < 2^53 / 100 at 2 decimals when re-rounded
export const roundRupees = (value: number) => Math.round(value * 100) / 100;
export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
