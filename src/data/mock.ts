export interface GoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  projectedMonth: string;
  status: 'on_track' | 'at_risk' | 'ahead';
}

export interface FixedCostItem {
  name: string;
  amount: number;
  frequency: string;
  merchant: string;
  category: string;
}

export interface SpendCategory {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

export interface SubscriptionAlert {
  id: string;
  name: string;
  amount: number;
  billingCycle: string;
  lastUsedDays: number;
  reason: string;
  status: 'unused' | 'price_hike' | 'active';
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const MOCK_PROFILE = {
  monthlyIncome: 87000,
  incomeSource: 'Techcorp Senior Product Engineer',
  frequency: 'Monthly (1st)',
  fixedCostsTotal: 31500,
  variableSpendAvg: 29900,
  emergencyFundBalance: 126000,
  emergencyFundTargetMonths: 6,
  emergencyFundCurrentMonths: 4.0,
  runwayDailySafeSpend: 850,
  profileVersion: 'v2.4.1 (Immutable Local Snapshot)',
};

export const MOCK_FIXED_COSTS: FixedCostItem[] = [
  { name: 'Indiranagar 2BHK Rent', amount: 22000, frequency: 'Monthly', merchant: 'Owner UPI / Axis', category: 'Housing' },
  { name: 'BESCOM Power & Utilities', amount: 1420, frequency: 'Monthly', merchant: 'BESCOM Bangalore', category: 'Utilities' },
  { name: 'Airtel Xstream Fiber (1Gbps)', amount: 999, frequency: 'Monthly', merchant: 'Airtel Telemedia', category: 'Utilities' },
  { name: 'HDFC Vehicle EMI', amount: 4580, frequency: 'Monthly', merchant: 'HDFC Auto Loan', category: 'Debt/EMI' },
  { name: 'Health Insurance Super Top-up', amount: 2500, frequency: 'Monthly', merchant: 'Niva Bupa Health', category: 'Insurance' },
];

export const MOCK_SPEND_CATEGORIES: SpendCategory[] = [
  { name: 'Dining & Cafes', amount: 14200, color: '#ff3b12', percentage: 47.5 },
  { name: 'Groceries & Household', amount: 8400, color: '#d4af37', percentage: 28.1 },
  { name: 'Urban Commute & Cabs', amount: 4100, color: '#10b981', percentage: 13.7 },
  { name: 'Recreation & Leisure', amount: 3200, color: '#8a867c', percentage: 10.7 },
];

export const MOCK_GOALS: GoalItem[] = [
  {
    id: 'goal-1',
    name: 'Emergency Buffer (6 Mo Target)',
    targetAmount: 189000,
    currentAmount: 126000,
    targetDate: 'Dec 2026',
    category: 'Safety',
    priority: 'high',
    projectedMonth: 'Nov 2026',
    status: 'ahead',
  },
  {
    id: 'goal-2',
    name: 'Kyoto & Tokyo Sabbatical Fund',
    targetAmount: 240000,
    currentAmount: 95000,
    targetDate: 'Oct 2027',
    category: 'Life Goal',
    priority: 'high',
    projectedMonth: 'Sep 2027',
    status: 'on_track',
  },
  {
    id: 'goal-3',
    name: 'MacBook Pro M4 Max Studio Rig',
    targetAmount: 199000,
    currentAmount: 140000,
    targetDate: 'Apr 2027',
    category: 'Hardware',
    priority: 'medium',
    projectedMonth: 'Jun 2027',
    status: 'at_risk',
  },
];

export const MOCK_SUBSCRIPTION_ALERTS: SubscriptionAlert[] = [
  {
    id: 'sub-1',
    name: 'Gold’s Gym Elite Tier',
    amount: 2499,
    billingCycle: 'Monthly',
    lastUsedDays: 62,
    reason: 'Zero transit swipes or attendance events detected in the last 62 days.',
    status: 'unused',
  },
  {
    id: 'sub-2',
    name: 'Cloud Pro Storage (2TB)',
    amount: 650,
    billingCycle: 'Monthly',
    lastUsedDays: 3,
    reason: 'Annual contract auto-renews on Nov 14th without prompt.',
    status: 'active',
  },
  {
    id: 'sub-3',
    name: 'Streaming Family Tier',
    amount: 899,
    billingCycle: 'Monthly',
    lastUsedDays: 8,
    reason: 'Price increased +12.5% (was ₹799) without explicit notification.',
    status: 'price_hike',
  },
];

export const MOCK_FAQS: FaqItem[] = [
  {
    question: 'How does INARI differ from conventional budgeting applications?',
    answer: 'Standard budgeting tools simply categorize transactions after money has already left your account and stop there. INARI builds a "living money model" — synthesizing real statements into your true baseline burn, calculating dynamic runway, and simulating what-if scenarios so you see exactly how life decisions impact your future goals before you make them.',
  },
  {
    question: 'Is my banking statement data private and secure?',
    answer: '100% private. INARI is built local-first. Raw statement parsing (PDF, CSV, SMS) happens securely in your personal instance without uploading financial transcripts to third-party ad networks or brokers. Your profile versions are stored in an immutable local database.',
  },
  {
    question: 'How does the What-If simulation engine operate?',
    answer: 'The scenario engine executes deterministic mathematical projections over configurable 24-to-60 month horizons. You can model lifestyle adjustments (e.g. cutting dining out by 30%), fixed cost shocks (e.g. a 10% rent hike), sabbaticals, or major one-off purchases. It computes exact goal arrival dates and runway changes without modifying your baseline profile until you explicitly save.',
  },
  {
    question: 'Can I override and steer the auto-detected categories?',
    answer: 'Yes. INARI uses an adaptive correction loop. If an auto-categorized merchant is misaligned, you can edit it once in the UI. INARI learns your personal classification rule and applies it consistently to all subsequent statements.',
  },
  {
    question: 'Why does INARI strictly prohibit recommending investment products?',
    answer: 'INARI is an educational financial coach, not a broker or affiliated seller. Traditional apps push high-commission mutual funds, credit cards, and crypto tokens. INARI eliminates conflict of interest: we model cash flow scenarios with pure deterministic Python math and never sell, solicit, or recommend specific securities.',
  },
  {
    question: 'What constitutes an "apparently unused" recurring subscription?',
    answer: 'INARI correlates recurring merchant charges with related lifestyle telemetry in your statements (such as zero metro/fuel swipes to a gym location, zero active app activity, or prolonged dormancy). When a recurring payment occurs with no corresponding usage signal for over 45 days, INARI flags it for your review.',
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Ingest Bank Statements',
    description: 'Drop in messy statement exports (PDF, CSV, SMS dumps). INARI cleans unstructured strings, isolates merchants, and flags income cadence automatically.',
  },
  {
    step: '02',
    title: 'Synthesize Living Profile',
    description: 'Fixed obligations (rent, utilities, insurance) are separated from variable burn. A persistent, versioned financial model calculates your true liquid runway.',
  },
  {
    step: '03',
    title: 'Simulate & Guard Goals',
    description: 'Stress-test real life events before spending. Model rent changes, sabbaticals, or discretionary adjustments to see goal delivery dates adapt in real time.',
  },
];

export const LIVING_WORLDS_DATA = [
  {
    id: 'ingestion',
    index: '01',
    title: 'INGESTION',
    theme: 'light',
    headline: 'MESSY STATEMENTS IN. CLEAN MODEL OUT.',
    subtext: 'Direct parsing of raw PDF, CSV, and transaction dumps. Cleans cryptic narration strings, identifies recurring salary inflows, and preserves user privacy.',
    stats: [
      { label: 'PARSING SPEED', value: '< 240ms' },
      { label: 'FORMAT ACCURACY', value: '99.4%' },
      { label: 'SUPPORTED TYPES', value: 'PDF / CSV / SMS' },
    ],
    codeSnippet: `>> inari ingest --file indiranagar_hdfc_oct.pdf\n[OK] 524 transactions parsed\n[OK] Monthly inflow detected: Techcorp INR 87,000.00\n[OK] 4 recurring obligations mapped`,
  },
  {
    id: 'rhythms',
    index: '02',
    title: 'RHYTHMS',
    theme: 'dark',
    headline: 'ISOLATING THE HARD BASELINE BURN.',
    subtext: 'Your living profile locks in your non-negotiable fixed costs: Indiranagar rent ₹22,000, utilities ₹1,420, broadband ₹999. Identifies rate creeps and zombie subscriptions.',
    stats: [
      { label: 'FIXED BURN', value: '₹31,500/MO' },
      { label: 'ACTIVE CADENCES', value: '5 RECURRING' },
      { label: 'ZOMBIE SERVICES', value: '1 FLAGGED' },
    ],
    codeSnippet: `[SENTINEL ALERT] Gold's Gym: INR 2,499.00 billed monthly.\nUsage telemetry: 0 check-ins logged past 60 days.\nPotential annual recovery: INR 29,988.00`,
  },
  {
    id: 'buffer',
    index: '03',
    title: 'BUFFER',
    theme: 'light',
    headline: 'TRUE RUNWAY IN MONTHS, NOT VAGUE ACCUMULATION.',
    subtext: 'Translates liquid reserves into mathematical survival time. 4.0 Months of non-discretionary expenses securely banked against life shocks.',
    stats: [
      { label: 'CURRENT RUNWAY', value: '4.0 MONTHS' },
      { label: 'LIQUID BUFFER', value: '₹1,26,000' },
      { label: 'SAFE DAILY BURN', value: '₹850 / DAY' },
    ],
    codeSnippet: `def compute_runway(liquid_balance, monthly_fixed_burn):\n    return round(liquid_balance / monthly_fixed_burn, 1)\n# Output: 4.0 Months Runway Protection`,
  },
  {
    id: 'what-if',
    index: '04',
    title: 'WHAT-IF',
    theme: 'dark',
    headline: 'STRESS-TEST CHOICES BEFORE COMMITTING RUPEES.',
    subtext: 'What if you cut dining out by 30%? What if rent jumps 10% next lease? What if you take a 4-month sabbatical? Project timelines across 24 configurable months.',
    stats: [
      { label: 'PROJECTION SPAN', value: '24 MONTHS' },
      { label: 'SIMULATION ENGINE', value: 'DETERMINISTIC' },
      { label: 'MUTATION RISK', value: '0% (READ-ONLY)' },
    ],
    codeSnippet: `scenario = apply_scenario(profile, adjustments=[\n  {"category": "Dining", "change_pct": -0.30},\n  {"fixed_cost": "Rent", "change_pct": +0.10}\n])\n# MacBook Goal accelerated by +3.5 months!`,
  },
  {
    id: 'nudges',
    index: '05',
    title: 'NUDGES',
    theme: 'light',
    headline: 'GENTLE DRIFT CORRECTION. NEVER FINANCIAL JUDGMENT.',
    subtext: 'Proactive velocity alerts when variable spend drifts away from profile targets. INARI nudges you mid-month so you never face month-end deficits.',
    stats: [
      { label: 'DRIFT LATENCY', value: 'REAL-TIME' },
      { label: 'TONE POLICY', value: 'NEUTRAL / RATIONAL' },
      { label: 'AFFILIATE PROMPTS', value: 'ZERO' },
    ],
    codeSnippet: `[INARI NUDGE] Mid-month variable pacing: INR 16,400 spent (Day 14).\nPacing is 18% ahead of baseline.\nSuggested safe burn for remainder: INR 720/day.`,
  },
  {
    id: 'review',
    index: '06',
    title: 'REVIEW',
    theme: 'dark',
    headline: 'THE MONTHLY LIVING FINANCIAL AUDIT.',
    subtext: 'Comprehensive month-over-month report: savings rate vs 3-month rolling averages, category outliers, subscription audits, and exportable PDF summaries.',
    stats: [
      { label: 'SAVINGS RATE', value: '29.4% (+4.2%)' },
      { label: 'OUTLIERS DETECTED', value: '2 NOTABLE' },
      { label: 'AUDIT EXPORT', value: 'HTML & PDF' },
    ],
    codeSnippet: `generate_monthly_report(month="2026-10")\n>> Cashflow surplus: +INR 25,600\n>> Goal allocation updated: Emergency Buffer +INR 15,000\n>> Report rendered with zero securities solicitation.`,
  },
];

