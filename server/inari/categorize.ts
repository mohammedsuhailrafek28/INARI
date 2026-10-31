/**
 * Deterministic merchant categorization. This is rules + user feedback, NOT a trained or fine-tuned model.
 * Precedence (highest first): user correction > learned merchant rule > deterministic rule > (future) model suggestion.
 */
import type { Category, CategorySource } from "../../shared/inari/contracts";

type Rule = { category: Category; pattern: RegExp; direction?: "debit" | "credit" };

// Order matters: the first matching rule wins, so specific rules come before broad ones.
export const DETERMINISTIC_RULES: Rule[] = [
  { category: "salary", direction: "credit", pattern: /\b(salary|sal cr|payroll|wages|stipend)\b/i },
  { category: "transfer", pattern: /\b(self transfer|own account|to self|sweep (in|out))\b/i },
  { category: "rent", pattern: /\b(rent|landlord|house rent|pg rent)\b/i },
  { category: "insurance", pattern: /\b(lic premium|\blic\b|insurance|hdfc life|star health|icici pru|policybazaar|policy no)\b/i },
  { category: "emi", pattern: /\b(emi|loan|bajaj fin|home loan|car loan|nach.*(loan|fin))\b/i },
  { category: "investment", pattern: /\b(sip|mutual fund|zerodha|groww|upstox|kuvera|nps|ppf|etmoney|coin by zerodha)\b/i },
  { category: "savings", pattern: /\b(fixed deposit|recurring deposit|\bfd\b|\brd\b|savings goal|goal fund)\b/i },
  // Card repayments are NOT utilities/bill-pay; they stay "other" and are surfaced as a reconciliation exception.
  { category: "other", pattern: /(credit card (payment|bill|repayment)|cc (payment|bill)|card ?pay)/i },
  { category: "groceries", pattern: /\b(bigbasket|blinkit|zepto|dmart|grofers|instamart|reliance fresh|more retail|jiomart|grocery|kirana|supermarket|nature'?s basket)\b/i },
  { category: "dining", pattern: /\b(swiggy|zomato|restaurant|cafe|starbucks|mcdonald|domino|kfc|pizza|eatery|barbeque|burger|chai|tea stall|snack|juice|bakery|canteen|biryani)\b/i },
  { category: "fuel", pattern: /\b(petrol|diesel|hpcl|bpcl|iocl|indian oil|shell|fuel|bharat petroleum)\b/i },
  { category: "subscription", pattern: /\b(netflix|spotify|prime video|amazon prime|hotstar|disney|youtube premium|apple\.com|icloud|google one|google play|adobe|sonyliv|zee5|jiocinema|subscription|audible|notion|chatgpt|openai)\b/i },
  { category: "entertainment", pattern: /\b(bookmyshow|pvr|inox|steam|dream11|gaming|concert|movie)\b/i },
  { category: "health", pattern: /\b(pharmacy|apollo|medplus|1mg|pharmeasy|hospital|clinic|diagnostic|cult\.?fit|gym|doctor|dental|lab test)\b/i },
  { category: "education", pattern: /\b(school|college|university|udemy|coursera|tuition|byju|unacademy|exam fee|course)\b/i },
  { category: "travel", pattern: /\b(irctc|makemytrip|goibibo|cleartrip|indigo|air india|vistara|oyo|airbnb|hotel|redbus|flight)\b/i },
  { category: "transport", pattern: /\b(uber|ola cabs|\bola\b|rapido|metro|fastag|parking|cab|auto fare|toll)\b/i },
  { category: "utilities", pattern: /\b(electricity|bescom|tneb|mseb|tata power|airtel|jio|vodafone|bsnl|broadband|fibernet|water bill|gas bill|lpg|recharge|dth|bill ?pay|postpaid)\b/i },
  { category: "shopping", pattern: /\b(amazon|flipkart|myntra|ajio|nykaa|meesho|decathlon|ikea|croma|lifestyle|shoppers stop|retail)\b/i },
  { category: "fees_tax", pattern: /\b(bank charges|sms charges|annual fee|penalty|\bgst\b|income tax|\btds\b|late fee|processing fee|service charge|min bal)\b/i },
  { category: "cash", pattern: /\b(atm|cash withdrawal|cash wdl|cash dep)\b/i },
  { category: "other_income", direction: "credit", pattern: /\b(interest|dividend|cashback|refund|reversal|bonus|freelance)\b/i },
];

/** Stable key used for learned rules: lowercase letters/digits words, no refs, max 3 words. */
export function merchantKey(merchantOrNarration: string | null | undefined): string {
  const words = (merchantOrNarration ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2 && !["upi", "neft", "imps", "rtgs", "pos", "ach", "payment", "to", "from", "the", "txn"].includes(w));
  return words.slice(0, 3).join(" ");
}

export type Classification = { category: Category; source: CategorySource; confidence: number };

export function classify(args: {
  narration: string;
  merchant: string | null;
  direction: "debit" | "credit";
  learned?: ReadonlyMap<string, Category>;
}): Classification {
  const key = merchantKey(args.merchant ?? args.narration);
  const learned = key ? args.learned?.get(key) : undefined;
  if (learned) return { category: learned, source: "learned", confidence: 0.95 };

  const text = `${args.merchant ?? ""} ${args.narration}`;
  for (const rule of DETERMINISTIC_RULES) {
    if (rule.direction && rule.direction !== args.direction) continue;
    if (rule.pattern.test(text)) return { category: rule.category, source: "rule", confidence: 0.85 };
  }
  return args.direction === "credit"
    ? { category: "other_income", source: "unclassified", confidence: 0.3 }
    : { category: "other", source: "unclassified", confidence: 0.3 };
}
