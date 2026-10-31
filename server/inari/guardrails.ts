/**
 * Output guardrails for any generated financial text (monthly report today; the advisor later).
 *
 * 1. No guaranteed / risk-free / assured-return claims.
 * 2. No specific investment recommendations (buy/sell/invest in a named asset class or product).
 * 3. No return projections.
 * 4. Every rupee amount and percentage in the text must be one of the numbers the backend computed ("facts").
 *    A number that is not in the fact set is an unverified numerical assertion and the text is replaced.
 */
export type GuardrailStatus = "passed" | "modified" | "refused";
export type GuardrailVerdict = { ok: boolean; reasons: string[] };

const PROHIBITED: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(guarantee[sd]?|guaranteed|assured (?:returns?|profits?)|risk[- ]free|sure[- ]?shot|no[- ]risk|double your money|cannot lose|can't lose)\b/i, reason: "Guaranteed-return or risk-free claims are not allowed." },
  {
    re: /\b(?:buy|sell|invest(?:ing)? in|put (?:your )?money (?:in|into)|switch to|start investing in|go for)\b[^.]{0,50}\b(?:stocks?|shares?|mutual funds?|index funds?|etfs?|crypto(?:currency)?|bitcoin|ipo|nifty|sensex|gold|fds?|fixed deposits?|bonds?|ulips?|nps|ppf|elss|sip in)\b/i,
    reason: "Specific investment recommendations are not allowed.",
  },
  // third-person/product projections only: "I will earn 20k less" is the user describing their own income
  { re: /(?<!\b(?:i|we|my salary|my income) )\b(?:will|would|can|could|should) (?:earn|return|yield|grow to|make you|give you)\b[^.]{0,40}(?:\d|₹|rs\b)/i, reason: "Return projections are not allowed." },
  { re: /\b\d+(?:\.\d+)?\s*%\s*(?:returns?|p\.?a\.?|per annum|annual(?:ly)?|interest|yield|cagr|growth)\b/i, reason: "Return or interest-rate figures are not allowed." },
];

const AMOUNT = /(?:₹|\brs\.?)\s*([\d,]+(?:\.\d+)?)/gi;
const PERCENT = /(\d+(?:\.\d+)?)\s*%/g;

/** Numbers appearing in `text` (rupee amounts and percentages), for verification against computed facts. */
export function numbersIn(text: string): { amounts: number[]; percents: number[] } {
  const amounts = Array.from(text.matchAll(AMOUNT)).map(m => Number(m[1].replace(/,/g, ""))).filter(Number.isFinite);
  const percents = Array.from(text.matchAll(PERCENT)).map(m => Number(m[1])).filter(Number.isFinite);
  return { amounts, percents };
}

const near = (value: number, facts: number[], tol: number) => facts.some(f => Math.abs(f - value) <= tol);

/** True when a *question* asks for something the advisor must refuse (specific investment advice or guaranteed returns). */
export function isProhibitedAdviceRequest(question: string): boolean {
  return (
    PROHIBITED.some(p => p.re.test(question)) ||
    /\b(which|what|best)\b[^.?]{0,40}\b(stock|share|mutual fund|etf|crypto|coin)s?\b[^.?]{0,20}\b(buy|invest|pick)\b/i.test(question) ||
    /\bshould i (?:buy|sell|invest)\b/i.test(question)
  );
}

export function checkText(text: string, facts: { amounts: number[]; percents: number[] }): GuardrailVerdict {
  const reasons: string[] = [];
  for (const p of PROHIBITED) if (p.re.test(text)) reasons.push(p.reason);
  const found = numbersIn(text);
  for (const a of found.amounts) if (!near(a, facts.amounts, 0.5)) reasons.push("A rupee amount in the text is not backed by a computed figure.");
  for (const p of found.percents) if (!near(p, facts.percents, 0.06)) reasons.push("A percentage in the text is not backed by a computed figure.");
  return { ok: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
}

/**
 * Returns the text if it passes, otherwise the supplied number-free fallback.
 * `status` is "refused" when a prohibited claim was present, "modified" when only numbers were unverified.
 */
export function guardText(text: string, fallback: string, facts: { amounts: number[]; percents: number[] }): { text: string; status: GuardrailStatus; reasons: string[] } {
  const v = checkText(text, facts);
  if (v.ok) return { text, status: "passed", reasons: [] };
  const prohibited = PROHIBITED.some(p => p.re.test(text));
  return { text: fallback, status: prohibited ? "refused" : "modified", reasons: v.reasons };
}
