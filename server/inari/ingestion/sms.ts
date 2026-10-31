/**
 * Deterministic SMS parser for Indian bank / UPI / card alerts.
 *
 * Privacy rules enforced here:
 *  - OTP / verification messages are recognised and dropped; nothing from them is returned, stored or logged.
 *  - The raw message body is never persisted. A booked transaction keeps only structured fields
 *    (amount in paise, date, merchant, rail, last-4 digits, reference) and a short narration rebuilt from them.
 *  - Reasons returned for skipped messages are fixed phrases that never echo message text.
 *
 * Only patterns covered by tests (data/parser-tests/sms corpus + authored fixtures) are claimed as supported.
 */
import { parseAmountToPaise } from "../money";
import { assignFingerprints, type Candidate, type CsvParseResult } from "./csvImport";
import type { Instrument } from "../../../shared/inari/contracts";

export type SmsKind =
  | "debit" | "credit" | "refund" | "reversal" | "upcoming" | "card_bill" | "declined" | "failed" | "pending" | "mandate" | "otp" | "non_financial";
export type SmsRail = "upi" | "card" | "bank_account" | "atm" | "transfer" | "wallet" | "unknown";

export type ParsedSms = {
  kind: SmsKind;
  rail: SmsRail;
  /** true when this message describes a completed movement that should become a ledger transaction (a date is still required) */
  bookable: boolean;
  direction: "debit" | "credit" | null;
  amountPaise: number | null;
  postedOn: string | null;
  merchant: string | null;
  accountLast4: string | null;
  cardLast4: string | null;
  reference: string | null;
  /** fixed phrase, never message text */
  reason: string | null;
  /** structured narration rebuilt from fields; null when nothing may be stored */
  narration: string | null;
};

export const SMS_MAX_AMOUNT_PAISE = 1_000_000_000; // ₹1 crore: larger single SMS amounts are not auto-booked
const MAX_MESSAGES = 5_000;

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// ---------- splitting ----------
const CONTINUATION = /^(from|to|on|ref|not you|if not|avl|info|date|upi|txn|available)\b/i;

export function splitMessages(text: string): string[] {
  const t = text.replace(/\r/g, "").replace(/\\n/g, "\n");
  const blocks = t.split(/\n\s*\n|\n-{3,}\n/).map(b => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks.map(b => b.replace(/\s*\n\s*/g, " "));
  const out: string[] = [];
  for (const line of (blocks[0] ?? "").split("\n").map(l => l.trim()).filter(Boolean)) {
    if (out.length > 0 && CONTINUATION.test(line)) out[out.length - 1] += ` ${line}`;
    else out.push(line);
  }
  return out;
}

// ---------- field extraction ----------
const AMOUNT = /(?:\brs\.?|\binr\b|₹)\s*:?\s*(\d[\d,]*(?:\.\d+)?)/gi;
const BALANCE_CONTEXT = /(avl|avail|available|balance|\bbal\b|limit|lmt|o\/s|outstanding|total amount due|minimum)[\s:.\-a-z]{0,14}$/i;

function amountsIn(t: string): Array<{ paise: number; balance: boolean }> {
  const out: Array<{ paise: number; balance: boolean }> = [];
  for (const m of Array.from(t.matchAll(AMOUNT))) {
    const parsed = parseAmountToPaise(m[1].replace(/,+$/, ""));
    if (!parsed || !parsed.ok) continue;
    const context = t.slice(Math.max(0, (m.index ?? 0) - 28), m.index ?? 0);
    out.push({ paise: parsed.paise, balance: BALANCE_CONTEXT.test(context) });
  }
  return out;
}

function transactionAmount(t: string): number | null {
  const first = amountsIn(t).find(a => !a.balance);
  if (first) return first.paise;
  // currency-less forms: "debited by 420.50", "transaction of 88.00"
  const m = /\b(?:debited|credited|debit|credit|transaction|txn|amt|amount)\b(?:\s+(?:by|of|for|with))?(?:\s+transfer of)?\s*:?\s*(\d[\d,]*\.\d{1,2})\b/i.exec(t);
  if (m) {
    const p = parseAmountToPaise(m[1]);
    if (p && p.ok) return p.paise;
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const year = y < 100 ? 2000 + y : y;
  if (year < 2000 || year > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const last = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  if (d > last) return null;
  return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function smsDate(t: string): string | null {
  const hits: Array<{ at: number; value: string | null }> = [];
  for (const m of Array.from(t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))) hits.push({ at: m.index ?? 0, value: iso(+m[1], +m[2], +m[3]) });
  for (const m of Array.from(t.matchAll(/\b(\d{1,2})[-/ ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/ ,]*(\d{4}|\d{2})\b/gi)))
    hits.push({ at: m.index ?? 0, value: iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) });
  for (const m of Array.from(t.matchAll(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})\b/g))) hits.push({ at: m.index ?? 0, value: iso(+m[3], +m[2], +m[1]) });
  hits.sort((a, b) => a.at - b.at);
  return hits.find(h => h.value)?.value ?? null;
}

function last4(t: string, kind: "account" | "card"): string | null {
  const re =
    kind === "account"
      ? /\b(?:a\/c|ac|acct|account)\b\.?(?:\s*no\.?)?(?:\s*ending(?:\s*with)?)?\s*[:*xX\s]*(\d{4,})\b/i
      : /\bcard\b\.?(?:\s*no\.?)?(?:\s*ending(?:\s*with)?)?\s*[:*xX\s]*(\d{4})\b/i;
  const m = re.exec(t);
  if (m) return m[1].slice(-4);
  if (kind === "card") {
    const m2 = /\bcard\b[^.\d]{0,25}?(?:ending(?:\s*with)?\s*)[xX*]*(\d{4})\b/i.exec(t) ?? (/\b(?:a\/c|ac|account)\b/i.test(t) ? null : /\bending(?:\s*with)?\s+(\d{4})\b/i.exec(t));
    if (m2) return m2[1];
  }
  if (kind === "account") {
    const m3 = /\b(?:a\/c|ac)\s*(?:no\.?)?\s*[xX*]+(\d{4})\b/i.exec(t) ?? /\bcredit card a\/c\s*\dx+(\d{4})\b/i.exec(t);
    if (m3) return m3[1];
  }
  return null;
}

function reference(t: string): string | null {
  const m =
    /\b(?:upi\/(?:p2m|p2a|p2p)\/|(?:upi\s+)?ref(?:erence)?(?:\s*(?:no\.?|number))?[\s.:#-]*|txn\s*id[\s.:#-]*|utr[\s.:#-]*)([A-Z]?\d{6,})\b/i.exec(t);
  return m ? m[1] : null;
}

const BAD_NAME = /^(your|a\/c|ac|account|my|the|card|wallet|bank|you|date|upi|vpa|ref|refno|transfer of)\b|^(rs|inr)\W*\d/i;
const NAME_END = "(?=\\s+(?:on|at|in|via|using|ref|refno|avl|avail|curr|your|from|for|is|has|dated|if|not|report|towards)\\b|\\s-\\s|[.,(]|$)";

function cleanName(s: string): string | null {
  const n = s.replace(/\s+/g, " ").replace(/[\s.,-]+$/, "").trim();
  return n.length >= 2 && !BAD_NAME.test(n) ? n : null;
}

function merchantOf(t: string, direction: "debit" | "credit" | null): string | null {
  let m = /\bUPI\/(?:P2M|P2A|P2P)\/\d+\/([A-Za-z0-9&_-]{2,40})/i.exec(t);
  if (m) return m[1].toUpperCase();
  m = /\b([a-z0-9._-]{2,})@[a-z][a-z0-9]{1,}\b/i.exec(t);
  if (m) return m[1].toLowerCase();
  m = /\byour\s+([A-Za-z]{3,20})\s+order\b/i.exec(t);
  if (m) return m[1].toUpperCase();
  m = /\(([A-Z][A-Z0-9 &.-]{3,40})\)/.exec(t); // NEFT narration in brackets, upper case
  if (m && direction === "credit") return cleanName(m[1]);
  const keywords = direction === "credit" ? ["by", "from"] : ["trf to", "transfer to", "to", "at", "towards", "by"];
  for (const kw of keywords) {
    const re = new RegExp(`\\b${kw}\\s+([A-Za-z][A-Za-z0-9&' .-]{1,38}?)${NAME_END}`, "gi");
    for (const hit of Array.from(t.matchAll(re))) {
      const n = cleanName(hit[1]);
      if (n && !/^\d/.test(n) && !/^[a-z]{2,4}-upi$/i.test(n) && !/^mob bk/i.test(n)) return n.toUpperCase();
    }
  }
  m = /\d{2}:\d{2}:\d{2}\s+([A-Za-z][A-Za-z ]{1,30}?)\s+(?:avl|avail)\b/i.exec(t);
  if (m) return m[1].toUpperCase();
  if (/\bpayment of\b.{0,40}\bcredited to your\b.{0,30}credit card/i.test(t)) return "CREDIT CARD PAYMENT";
  m = /\b(debit card annual fee|annual fee)\b/i.exec(t);
  return m ? m[1].toUpperCase() : null;
}

// ---------- classification ----------
const COMPLETED_DEBIT =
  /\b(debited|spent|withdrawn|deducted|sent|paid|paying|purchase)\b|\bdebit\s+(?:by|of|inr|rs|₹|with|for)\b|\bdebit\s+(?:inr|rs)\b|\bdebit\b(?=\s+(?:inr|rs))|\bthank you for using your .{0,40}card\b/i;
const COMPLETED_CREDIT = /\b(credited|received|deposited)\b/i;
const BANK_SIGNAL = /\b(a\/c|ac|acct|account|card|upi|vpa|wallet|imps|neft|rtgs|atm|netbanking|txn id|payment confirmed)\b/i;
const SUSPICIOUS = /(https?:\/\/|www\.|\bclick\b|\btap (?:on|here)\b|\bbit\.ly\b|\.invalid\b)/i;

const result = (kind: SmsKind, reason: string, extra: Partial<ParsedSms> = {}): ParsedSms => ({
  kind, rail: "unknown", bookable: false, direction: null, amountPaise: null, postedOn: null, merchant: null,
  accountLast4: null, cardLast4: null, reference: null, reason, narration: null, ...extra,
});

export function parseSms(raw: string): ParsedSms {
  const t = raw.replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
  if (t.length === 0) return result("non_financial", "Empty message.");

  const hasDebit = COMPLETED_DEBIT.test(t);
  const hasCredit = COMPLETED_CREDIT.test(t);

  // A verification message is dropped before anything is extracted. A real transaction alert that merely
  // carries a "never share your OTP" footer still has a completed-transaction verb and is parsed normally.
  if (/\b(otp|one[- ]time (?:password|pin)|verification code|security code|login code|cvv)\b/i.test(t) && !hasDebit && !hasCredit) {
    return result("otp", "One-time password message ignored; its content is not stored.");
  }

  const amount = transactionAmount(t);
  const postedOn = smsDate(t);
  const accountLast4 = last4(t, "account");
  const cardLast4 = last4(t, "card");
  const ref = reference(t);
  const base = { amountPaise: amount, postedOn, accountLast4, cardLast4, reference: ref };

  // "reversed ... for a failed transaction" is a credit coming back, not a failure notice
  if (/\b(declined|failed|unsuccessful|not successful|unable to process)\b/i.test(t) && !/\b(reversed|reversal|refund(?:ed)?)\b/i.test(t)) {
    return result(/declined/i.test(t) ? "declined" : "failed", "Payment did not complete; nothing was booked.", { ...base, amountPaise: amount });
  }
  if (/\b(pending|in process|being processed|awaiting|under review)\b/i.test(t))
    return result("pending", "Payment is still pending; it is booked only when a completed alert arrives.", base);
  if (/\bmandate\b/i.test(t)) return result("mandate", "Mandate notice; no money has moved yet.", base);
  if (/(statement (?:has been )?generated|total (?:amount )?due|minimum (?:amount )?(?:due|payment)|pay minimum|total payment of .{0,40} is due|bill (?:is )?due)/i.test(t))
    return result("card_bill", "Card bill notice; the payment itself is not a transaction yet.", base);
  if (/\b(will be (?:debited|deducted|charged)|is due on|due on|reminder|upcoming|scheduled for)\b/i.test(t))
    return result("upcoming", "Upcoming payment reminder; nothing has been paid yet.", base);
  if (SUSPICIOUS.test(t)) return result("non_financial", "Message contains a link or call to action and was not booked.");
  if (/\b(returned unpaid|bounced|unpaid)\b/i.test(t)) return result("non_financial", "Cheque notice; not a completed transaction.");
  if (/\b(this month|spend analysis|summary|statement of)\b/i.test(t) && !hasCredit) return result("non_financial", "Spending summary, not a transaction.");
  if (/\b(cashback|reward points?|% off|pre-?approved|congratulations|apply now|shop now|flat rs)\b/i.test(t))
    return result("non_financial", "Promotional message; not booked.");

  const isReversal = /\b(reversed|reversal)\b/i.test(t);
  const isRefund = /\brefund(?:ed)?\b/i.test(t);
  const wallet = /\bwallet\b/i.test(t);
  const creditCardSide = /\bcredit card\b/i.test(t) || (cardLast4 !== null && accountLast4 === null);
  const rail: SmsRail = /\batm\b/i.test(t)
    ? "atm"
    : wallet
      ? "wallet"
      : /\bupi\b|\bvpa\b|@[a-z]/i.test(t)
        ? "upi"
        : /\b(imps|neft|rtgs)\b/i.test(t)
          ? "transfer"
          : /\bcard\b/i.test(t)
            ? "card"
            : "bank_account";

  let kind: SmsKind;
  let direction: "debit" | "credit" | null;
  if (isReversal) {
    kind = "reversal";
    direction = "credit";
  } else if (isRefund) {
    kind = "refund";
    direction = "credit";
  } else if ((hasDebit || hasCredit) && BANK_SIGNAL.test(t)) {
    const d = t.search(COMPLETED_DEBIT);
    const c = t.search(COMPLETED_CREDIT);
    direction = hasDebit && (!hasCredit || d < c) ? "debit" : "credit";
    kind = direction;
  } else {
    return result("non_financial", "No completed transaction found in this message.", base);
  }

  const merchant = merchantOf(t, direction);
  const full = { ...base, rail, direction, merchant, kind };
  if (amount === null || amount <= 0) return result(kind, "No amount could be read.", { ...full, amountPaise: null });
  if (amount > SMS_MAX_AMOUNT_PAISE) return result("non_financial", "Amount is unusually large; confirm it by importing the bank statement instead.", { ...full, kind: "non_financial" });
  if (direction === "credit" && (creditCardSide || wallet)) {
    return result(kind, "Credit applies to a card or wallet account that is not imported; not booked.", full);
  }

  const words = kind === "debit" || kind === "credit" ? kind : `${kind} credit`;
  const narration = [
    `SMS ${rail.replace("_", " ")} ${words}`,
    merchant ? `: ${merchant}` : "",
    accountLast4 ? ` (A/c ..${accountLast4})` : cardLast4 ? ` (card ..${cardLast4})` : "",
    ref ? ` ref ${ref}` : "",
  ].join("");
  return { ...full, bookable: true, reason: null, narration };
}

// ---------- import ----------
const instrumentFor = (rail: SmsRail, narration: string): Instrument => {
  if (rail === "upi") return "upi";
  if (rail === "card") return "card";
  if (rail === "atm") return "atm";
  if (/\bimps\b/i.test(narration)) return "imps";
  return "other";
};

const normKey = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseSmsImport(text: string, opts: { userKey: string }): CsvParseResult {
  const messages = splitMessages(text);
  const warnings: string[] = [];
  const candidates: Candidate[] = [];
  const rejected: CsvParseResult["rejected"] = [];
  const ignored: CsvParseResult["ignored"] = [];
  if (messages.length > MAX_MESSAGES) warnings.push(`Only the first ${MAX_MESSAGES} messages were read.`);

  messages.slice(0, MAX_MESSAGES).forEach((msg, i) => {
    const rowNumber = i + 1;
    const p = parseSms(msg);
    if (!p.bookable || !p.direction || p.amountPaise === null) {
      if (p.kind === "debit" || p.kind === "credit" || p.kind === "refund" || p.kind === "reversal") {
        // looked like a transaction but cannot be booked safely: surface it, never drop silently
        (p.reason?.startsWith("Credit applies") ? ignored : rejected).push({ rowNumber, reason: p.reason ?? "Could not be read." });
      } else {
        ignored.push({ rowNumber, reason: p.reason ?? "Not a transaction." });
      }
      return;
    }
    if (!p.postedOn) {
      rejected.push({ rowNumber, reason: "The message has no date, so it cannot be placed in a month. Paste it with its date." });
      return;
    }
    const narration = p.narration ?? "SMS transaction";
    const keyTail = p.reference ?? `${normKey(p.merchant)}|${p.accountLast4 ?? p.cardLast4 ?? ""}`;
    candidates.push({
      rowNumber,
      postedOn: p.postedOn,
      amountPaise: p.amountPaise,
      direction: p.direction,
      narration,
      merchant: p.merchant,
      instrument: instrumentFor(p.rail, narration),
      balanceAfterPaise: null, // balances quoted in SMS are never used to infer account balances
      reference: p.reference,
      isTransfer: false,
      source: "sms",
      baseKey: ["sms", p.postedOn, p.amountPaise, p.direction, keyTail].join("|"),
      fingerprint: "",
    });
  });
  assignFingerprints(opts.userKey, candidates);
  return { format: "sms", candidates, rejected, ignored, warnings };
}
