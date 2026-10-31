/**
 * Rule-based intent analysis for dictated or typed English. Deterministic: no LLM, no network, no randomness.
 * Handles filler words, number words ("five thousand"), Indian units (k, lakh, crore), percents, "half",
 * spoken self-corrections ("4000, actually make that 5000") and builds a what-if Scenario when it has enough
 * information. It never guesses a missing number: it asks a clarification question instead.
 */
import type { Category, Intent, IntentAnalysis, Scenario } from "../../../shared/inari/contracts";

type Previous = { intent: Intent; amount: number | null; category: Category | null };
type Quantity = { value: number; kind: "amount" | "percent"; explicit: boolean; start: number; end: number; cue: string | null };

const FILLERS = /\b(um+|uh+|uhh+|erm+|er|hmm+|ah+|you know|kind of|sort of|basically|like i said)\b/g;

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const MULT: Record<string, number> = { hundred: 100, thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, k: 1e3 };
const NUM_WORD = new RegExp(`\\b(?:(?:${[...Object.keys(UNITS), ...Object.keys(MULT).filter(k => k !== "k")].join("|")})(?:[\\s-]+(?:and[\\s-]+)?)?)+\\b`, "g");

export function wordsToDigits(text: string): string {
  return text.replace(NUM_WORD, (match, offset: number, whole: string) => {
    const words = match.split(/[\s-]+/).filter(w => w && w !== "and");
    // "1.5 lakh": a bare multiplier right after a digit is the unit of that number, not a number word
    if (!words.some(w => w in UNITS) && /\d\s*$/.test(whole.slice(0, offset))) return match;
    let total = 0;
    let current = 0;
    for (const w of words) {
      if (w in UNITS) current += UNITS[w];
      else if (w === "hundred") current = (current || 1) * 100;
      else if (w in MULT) {
        total += (current || 1) * MULT[w];
        current = 0;
      }
    }
    return ` ${total + current} `;
  });
}

export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(\d),(?=\d{2,3}\b)/g, "$1")
    .replace(FILLERS, " ")
    .replace(/[^a-z0-9%₹.\s'-]/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CUE = /(actually|no wait|wait no|wait|i mean|sorry|make that|make it|rather|scratch that|correction|no no|change that to|or rather|let me correct that|but)\s*(?:it\s*)?(?:to\s*|be\s*|say\s*)?$/;

function findQuantities(text: string): Quantity[] {
  const out: Quantity[] = [];
  const re = /(₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(%|percent|per cent|k\b|thousand|lakhs?|lacs?|crores?)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const num = parseFloat(m[2]);
    const suffix = m[3] ?? "";
    const currency = !!m[1];
    const before = text.slice(Math.max(0, m.index - 14), m.index);
    // years and day counts are not money
    const looksLikeYear = num >= 2020 && num <= 2100 && new RegExp(`(${MONTHS.join("|")}|year|in|of)\\s*$`).test(before);
    const isDuration = /\b(in|for|last|next|past)\s*$/.test(before) && /^\s*(months?|days?|weeks?|years?)\b/.test(text.slice(re.lastIndex));
    if (!currency && !suffix && (looksLikeYear || isDuration)) continue;
    const isPercent = /%|percent|per cent/.test(suffix);
    const mult = /^k$/.test(suffix) || suffix === "thousand" ? 1e3 : /^lac|^lakh/.test(suffix) ? 1e5 : /^crore/.test(suffix) ? 1e7 : 1;
    const start = m.index + (m[0].length - m[0].trimStart().length);
    const window = text.slice(Math.max(0, start - 28), start).trimEnd();
    const cueMatch = CUE.exec(window + " ");
    out.push({ value: isPercent ? num : num * mult, kind: isPercent ? "percent" : "amount", explicit: currency || !!suffix, start, end: re.lastIndex, cue: cueMatch ? cueMatch[1] : null });
  }
  if (/\bhalf\b/.test(text) && !out.some(q => q.kind === "percent")) {
    const i = text.search(/\bhalf\b/);
    out.push({ value: 50, kind: "percent", explicit: true, start: i, end: i + 4, cue: null });
  } else if (/\bquarter\b/.test(text) && !out.some(q => q.kind === "percent")) {
    const i = text.search(/\bquarter\b/);
    out.push({ value: 25, kind: "percent", explicit: true, start: i, end: i + 7, cue: null });
  }
  out.sort((a, b) => a.start - b.start);
  // a bare number right after a correction cue inherits the kind of the number it corrects ("30 percent, actually 40")
  for (let i = 1; i < out.length; i++) {
    const q = out[i];
    const prev = out[i - 1];
    if (q.cue && !q.explicit && prev.kind === "percent" && q.value <= 100) q.kind = "percent";
  }
  return out;
}

const CATEGORY_WORDS: Array<[Category, RegExp]> = [
  ["dining", /\b(food delivery|eating out|dining|restaurants?|takeout|take-out|cafes?|coffee|snacks?|swiggy|zomato|starbucks|ordering in|food)\b/],
  ["groceries", /\b(groceries|grocery|bigbasket|blinkit|zepto|supermarket|instamart)\b/],
  ["fuel", /\b(petrol|diesel|fuel)\b/],
  ["transport", /\b(uber|ola|cabs?|taxis?|autos?|metro|commute|commuting|transport)\b/],
  ["rent", /\brent\b/],
  ["utilities", /\b(electricity|utilit(?:y|ies)|bills|broadband|internet|phone bill|mobile bill)\b/],
  ["subscription", /\b(subscriptions?|netflix|spotify|prime|ott|streaming|hotstar)\b/],
  ["shopping", /\b(shopping|amazon|flipkart|myntra|clothes|clothing)\b/],
  ["entertainment", /\b(entertainment|movies?|gaming|games)\b/],
  ["health", /\b(health|medical|pharmacy|gym|doctor)\b/],
  ["insurance", /\binsurance\b/],
  ["education", /\b(education|tuition|courses?)\b/],
  ["travel", /\b(travel|trips?|vacations?|flights?|holidays?)\b/],
  ["emi", /\b(emis?|loan payments?)\b/],
  ["cash", /\b(cash withdrawals?|atm)\b/],
];
const MERCHANTS = ["swiggy", "zomato", "amazon", "flipkart", "netflix", "spotify", "uber", "ola", "bigbasket", "blinkit", "zepto", "starbucks", "myntra", "hotstar"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const UNSAFE = /\b(guarantee[ds]?|guaranteed returns?|sure shot|insider|which stocks? (?:should|to) (?:i )?buy|best stocks?|stock tips?|crypto tips?|double my money|get rich quick|evade tax|avoid tax illegally|launder|hack|bypass|fake (?:statement|payslip)|send money|transfer money|pay (?:my|the) (?:bill|rent)|place (?:an )?order)\b/;
const WHAT_IF = /\b(what if|what would happen|what happens if|suppose|supposing|how much (?:would|could|can) i save|if i (?:cut|reduce|stop|cancel|skip|lower|trim|limit|get|start|pay|buy|lose|spend|invest|earn)|if my (?:salary|income)|can i afford|i(?:'ll| will| would) (?:earn|make|get|lose)\b[^.?]*\b(?:less|more)|(?:earn|make)s? [\d.,]+ ?k? (?:less|more))\b/;
const CORRECTION = /\b(recategori[sz]e|re-categori[sz]e|that(?:'s| is| was) (?:not|actually|wrong)|this(?:'s| is| was) (?:not|actually|wrong)|move (?:it|this|that) to|mark (?:it|this|that) as|should be (?:under|in|a)?|wrongly categori[sz]ed|wrong category)\b/;
const SUBS = /\b(subscriptions?|recurring|autopay|auto-pay|mandates?|renewals?)\b/;
const REVIEW = /\b(monthly (?:review|report|summary)|month in review|how (?:was|did) (?:last|this) month|review (?:my )?(?:last |this )?month)\b/;
const GOAL = /\b(goals?|saving for|on track|target)\b/;
const SPEND_Q = /\b(how much (?:did|have|do) i (?:spend|spent)|what did i spend|spent on|biggest expenses?|top spending|where (?:does|did) my money go|total spend)\b/;
const EXPLAIN = /\b(why (?:is|are|did|was)|what(?:'s| is) (?:in|behind)|explain)\b/;
const FOLLOWUP = /^(?:and |what about |how about |make it |same for |and for |instead |no )/;

const SIP_VALUE_MSG =
  "I can show how a monthly SIP changes your cash flow, but I cannot project what it will be worth later: that needs an expected rate of return, which I do not assume or invent. Ask what a SIP of that amount does to your monthly surplus, or use a calculator with a rate you choose.";
const SIP_VALUE_Q = /\b(\d+ years?|years?|decades?|corpus|worth|grow|growth|returns?|future value|maturity|mature|end up with|will i have|be valued)\b/;

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function detectPeriod(t: string): IntentAnalysis["period"] {
  const rel = /\b(last|this|next|previous) (month|week|year)\b/.exec(t);
  if (rel) return { kind: "relative", value: `${rel[1] === "previous" ? "last" : rel[1]}_${rel[2]}` };
  const mon = new RegExp(`\\b(${MONTHS.join("|")})(?: (\\d{4}))?\\b`).exec(t);
  if (mon) return { kind: "month", value: `${mon[2] ?? new Date().getUTCFullYear()}-${String(MONTHS.indexOf(mon[1]) + 1).padStart(2, "0")}` };
  return null;
}

export function analyzeIntentText(rawText: string, previous?: Previous): IntentAnalysis {
  const normalizedText = normalizeText(rawText);
  const t = wordsToDigits(normalizedText).replace(/\s+/g, " ").trim();

  const quantities = findQuantities(t);
  const corrections: IntentAnalysis["corrections"] = [];
  const superseded = new Set<Quantity>();
  const last: Partial<Record<Quantity["kind"], Quantity>> = {};
  for (const q of quantities) {
    const prev = last[q.kind];
    const notBut = prev && /\bnot\s*$/.test(t.slice(Math.max(0, prev.start - 6), prev.start)) && q.cue === "but";
    if (prev && (q.cue || notBut)) {
      corrections.push({ from: prev.value, to: q.value, cue: q.cue ?? "not … but" });
      superseded.add(prev);
    }
    last[q.kind] = q;
  }
  const amounts = quantities.filter(q => q.kind === "amount");
  const percents = quantities.filter(q => q.kind === "percent");
  const ambiguities: string[] = [];
  const finalAmounts = amounts.filter(q => !superseded.has(q));
  const finalPercents = percents.filter(q => !superseded.has(q));
  const amount = finalAmounts.length ? finalAmounts[finalAmounts.length - 1].value : null;
  const percent = finalPercents.length ? finalPercents[finalPercents.length - 1].value : null;
  if (finalAmounts.length > 1) ambiguities.push(`Several amounts were mentioned (${finalAmounts.map(q => q.value).join(", ")}); using the last one.`);

  // category / merchant (first mention wins; two different categories need a question)
  const found: Array<{ category: Category; index: number }> = [];
  for (const [category, re] of CATEGORY_WORDS) {
    const m = re.exec(t);
    if (m) found.push({ category, index: m.index });
  }
  found.sort((a, b) => a.index - b.index);
  let category: Category | null = found[0]?.category ?? null;
  const merchantWord = MERCHANTS.find(w => new RegExp(`\\b${w}\\b`).test(t));
  const merchant = merchantWord ? cap(merchantWord) : null;
  if (found.length > 1) ambiguities.push(`More than one category was mentioned (${found.map(f => f.category).join(", ")}).`);

  const period = detectPeriod(t);
  const base = {
    implementation: "implemented" as const,
    rawText,
    normalizedText,
    merchant,
    amount,
    amountsMentioned: amounts.map(q => q.value),
    percent,
    period,
    corrections,
  };
  const done = (intent: Intent, confidence: number, extra: Partial<IntentAnalysis> = {}): IntentAnalysis => {
    const needsClarification = extra.needsClarification ?? false;
    return {
      ...base,
      intent,
      confidence: Math.max(0.1, Math.min(0.97, round2(confidence - 0.08 * ambiguities.length - (needsClarification ? 0.15 : 0)))),
      category,
      scenario: null,
      ambiguities,
      needsClarification,
      clarificationQuestion: null,
      requiresConfirmation: false,
      ...extra,
    };
  };

  if (UNSAFE.test(t)) return done("unsafe_request", 0.9, { category: null });

  const isFollowUp = !!previous && (FOLLOWUP.test(t) || (t.split(" ").length <= 5 && (percent !== null || amount !== null || category !== null)));
  if (isFollowUp && previous) {
    category = category ?? previous.category;
    if (previous.intent === "what_if") {
      const scenario = buildReduceScenario(t, category, amount, percent);
      if (scenario) return done("clarification_followup", 0.8, { category, scenario });
    }
    return done("clarification_followup", 0.6, { category, amount: amount ?? previous.amount });
  }

  if (CORRECTION.test(t)) {
    // the category being moved TO is the last one mentioned
    category = found.length ? found[found.length - 1].category : null;
    return category
      ? done("category_correction", 0.8, { category, requiresConfirmation: true })
      : done("category_correction", 0.5, { needsClarification: true, clarificationQuestion: "Which category should it be moved to?", requiresConfirmation: true });
  }

  // "what will my SIP be worth": a return projection needs a rate the user has not given; never invent one or report "no change"
  if (/\b(sip|mutual funds?)\b/.test(t) && SIP_VALUE_Q.test(t) && !/\b(cash ?flow|surplus|afford)\b/.test(t))
    return done("what_if", 0.7, { needsClarification: true, clarificationQuestion: SIP_VALUE_MSG });

  if (WHAT_IF.test(t)) return whatIf(t, { done, category, amount, percent, quantities, found, ambiguities });

  if (REVIEW.test(t)) return done("monthly_review", 0.85);
  if (SUBS.test(t)) return done("subscription_query", 0.8);
  if (SPEND_Q.test(t)) return done("spending_question", 0.8);
  if (EXPLAIN.test(t) && category) return done("category_explanation", 0.75);
  if (GOAL.test(t)) return done("goal_progress", 0.7);
  if (category && /\b(spend|spent|spending)\b/.test(t)) return done("spending_question", 0.65);
  return done("unknown", 0.2);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function buildReduceScenario(t: string, category: Category | null, amount: number | null, percent: number | null): Scenario | null {
  if (!category) return null;
  if (percent !== null) return { type: "reduce_category", category, percent: Math.min(100, Math.max(1, percent)) };
  if (amount !== null && /\b(cut|reduce|lower|trim|save|less|decrease|slash|drop)\b[^.]*\b(by)?\s*\d/.test(t)) return { type: "reduce_category", category, amountPerMonth: amount };
  return null;
}

type WhatIfArgs = {
  done: (intent: Intent, confidence: number, extra?: Partial<IntentAnalysis>) => IntentAnalysis;
  category: Category | null;
  amount: number | null;
  percent: number | null;
  quantities: Quantity[];
  found: Array<{ category: Category; index: number }>;
  ambiguities: string[];
};

function whatIf(t: string, a: WhatIfArgs): IntentAnalysis {
  const { done, category, amount, percent, found } = a;
  const ask = (question: string, extra: Partial<IntentAnalysis> = {}) =>
    done("what_if", 0.7, { category, needsClarification: true, clarificationQuestion: question, ...extra });

  const inMonths = (() => {
    const m = /\bin (\d+) months?\b/.exec(t);
    if (m) return Math.min(24, parseInt(m[1], 10));
    if (/\bnext month\b/.test(t)) return 1;
    if (/\b(this month|right now|today)\b/.test(t)) return 0;
    if (/\b(next year|in a year)\b/.test(t)) return 12;
    return 0;
  })();

  // debt payoff
  if ((/\b(pay (?:off|down)|clear|repay|payoff)\b/.test(t) || /\bpay\b[^.]*\btowards?\b/.test(t)) && /\b(card|credit card|debt|loan)\b/.test(t)) {
    if (amount === null) return ask("How much per month would you put toward it?");
    return done("what_if", 0.85, { scenario: { type: "pay_down_debt", amountPerMonth: amount } });
  }

  // SIP / investing
  if (/\b(sip|invest(?:ing)?|mutual funds?)\b/.test(t) && /\b(start|begin|put|invest|sip)\b/.test(t)) {
    if (/\b(\d+ years?|years?|decades?|corpus|worth|grow|growth|returns?|future value|maturity|mature|end up with|will i have|be valued)\b/.test(t) && !/\b(cash ?flow|surplus|afford)\b/.test(t)) {
      return ask(SIP_VALUE_MSG);
    }
    if (amount === null) return ask("How much per month would you invest?");
    return done("what_if", 0.85, { scenario: { type: "start_sip", amountPerMonth: amount } });
  }

  // income changes
  if (/\b(salary|income|raise|hike|bonus|earn)\b/.test(t) && /\b(raise|hike|increase|increases|rises?|more|goes up|bonus|get(?:s)? a raise|drops?|decrease|cut|lose|less|falls?)\b/.test(t) && found.length === 0) {
    const down = /\b(drops?|decrease|cut|lose|less|falls?|reduced?)\b/.test(t);
    if (percent !== null && amount === null) return ask("What is the change in rupees per month? A percent needs your exact current salary.");
    if (amount === null) return ask(down ? "By how much does your income drop per month?" : "By how much does your income rise per month?");
    return done("what_if", 0.85, { scenario: { type: "change_income", deltaPerMonth: down ? -amount : amount } });
  }

  // one-off purchase
  if (/\b(buy|purchase|one-?time|one off|once|splurge)\b/.test(t) && !/\b(cut|reduce|stop|cancel)\b/.test(t)) {
    if (amount === null) return ask("How much would the purchase cost?");
    return done("what_if", 0.85, { scenario: { type: "one_off_expense", amount, inMonths } });
  }

  // reductions
  const stop = /\b(stop|quit|cancel|eliminate|give up|skip|unsubscribe|no more)\b/.test(t);
  const cutVerb = /\b(cut|reduce|lower|decrease|trim|slash|drop|limit|halve|save on|spend less|less)\b/.test(t);
  if (stop || cutVerb) {
    if (found.length > 1) {
      return ask(`I can model one category at a time. Which first: ${found.map(f => f.category).join(" or ")}?`);
    }
    if (!category) return ask("Which spending category do you mean?");
    if (/\bto\s*\d/.test(t) && percent === null) {
      return ask("Do you mean reduce BY that amount, or reduce TO that amount per month?");
    }
    const pct = /\bhalve\b/.test(t) ? 50 : stop && percent === null && amount === null ? 100 : percent;
    const scenario = buildReduceScenario(t, category, amount, pct);
    if (scenario) {
      if (category === "subscription" && stop) a.ambiguities.push("Applying to all subscription spending; named subscriptions are not supported yet.");
      return done("what_if", 0.9, { category, scenario });
    }
    return ask(`By how much would you reduce ${category.replace("_", " ")}: a percent or an amount per month?`);
  }

  return ask("What change would you like to try? For example: cut dining by 30%.");
}
