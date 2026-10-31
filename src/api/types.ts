export interface TransactionItem {
  TransactionID: string;
  TransactionDate: string;
  Description: string;
  Category: string;
  TransactionType: string;
  PaymentMode?: string;
  Amount: number;
  IsRecurring?: string;
  Notes?: string;
}

export interface TransactionListResponse {
  transactions: TransactionItem[];
  total: number;
  page: number;
  page_size: number;
  categories: string[];
}

export interface EmergencyFundData {
  current_balance: number;
  target_months: number;
  monthly_expense_base: number;
  target_amount: number;
  progress_pct: number;
}

export interface GoalItem {
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  priority: "High" | "Medium" | "Low";
  progress_pct: number;
  is_completed: boolean;
}

export interface IncomeSourceItem {
  source: string;
  amount: number;
  frequency: string;
  monthly_amount: number;
  confidence: number;
  is_active: boolean;
}

export interface FixedCostItem {
  name: string;
  category: string;
  amount: number;
  frequency: string;
  monthly_amount: number;
  is_recurring: boolean;
  confidence: number;
}

export interface FinancialProfileData {
  version: number;
  updated_at: string;
  source: string;
  total_monthly_income: number;
  total_monthly_fixed_costs: number;
  net_monthly_cash_flow: number;
  income_sources: IncomeSourceItem[];
  fixed_costs: FixedCostItem[];
  emergency_fund: EmergencyFundData;
  goals: GoalItem[];
}

export interface ProfileHistoryItem {
  version: number;
  created_at: string;
  source: string;
  summary: string;
}

export interface NudgeItem {
  id: string;
  category: string;
  severity: "info" | "warning" | "high";
  title: string;
  message: string;
  action: string;
  adjustment?: SimulationAdjustment | null;
}

export interface OverviewData {
  monthly_inflow: number;
  monthly_outflow: number;
  net_cash_flow: number;
  savings_rate: number;
  emergency_runway_months: number;
  emergency_fund: EmergencyFundData;
  goals: GoalItem[];
  profile_version: number;
  profile_source: string;
  profile_updated_at: string;
  active_nudges: NudgeItem[];
  active_nudges_count: number;
  recent_transactions: TransactionItem[];
}

export interface SubscriptionItem {
  name: string;
  category: string;
  amount: number;
  cadence: string;
  next_charge_date: string;
  status: "New" | "Changed" | "Apparently Unused" | "Dormant" | "Active" | "Unchanged";
  explanation: string;
  is_price_hike: boolean;
  is_unused: boolean;
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionItem[];
  sentinel_heuristic: string;
}

export interface SimulationAdjustment {
  adjustment_type: "category_spend" | "fixed_cost" | "income" | "new_recurring" | "one_time_expense" | "goal_change";
  target: string;
  value: number;
  change_type: "percent" | "amount";
  start_month?: number;
  target_date?: string;
}

export interface TimelineDataPoint {
  month: string;
  baseline_savings: number;
  scenario_savings: number;
  baseline_cash_flow: number;
  scenario_cash_flow: number;
}

export interface GoalOutcomeItem {
  goal_name: string;
  priority: string;
  target_date: string;
  baseline_status: string;
  scenario_status: string;
  completion_shift_months: number | null;
  is_infeasible_scenario: boolean;
  scenario_completion: string;
}

export interface SimulationResponse {
  horizon_months: number;
  monthly_cash_flow_diff: number;
  final_savings_diff: number;
  emergency_runway_diff: number;
  scenario_cash_flow: number;
  scenario_final_savings: number;
  scenario_runway: number;
  timeline: TimelineDataPoint[];
  goal_outcomes: GoalOutcomeItem[];
  plain_language_summary: string;
}

export interface CashFlowSummary {
  income: number;
  spending: number;
  net_savings: number;
  savings_rate: number;
  income_mom_change?: number;
  spending_mom_change?: number;
  savings_mom_change?: number;
  savings_rate_mom_change?: number;
  trailing_3m_avg_income: number;
  trailing_3m_avg_spending: number;
  trailing_3m_avg_savings: number;
  trailing_3m_avg_savings_rate: number;
}

export interface CategorySpendChangeItem {
  category: string;
  current_spend: number;
  mom_change_amount?: number;
  mom_change_percent?: number;
  trailing_3m_avg: number;
  is_outlier: boolean;
  outlier_reason?: string;
}

export interface SuggestedActionItem {
  title: string;
  description: string;
  rationale: string;
  projected_benefit: string;
  scenario_adjustments: SimulationAdjustment[];
}

export interface MonthlyReportData {
  month: string;
  generated_at: string;
  cash_flow: CashFlowSummary;
  top_categories: CategorySpendChangeItem[];
  biggest_increases: CategorySpendChangeItem[];
  biggest_decreases: CategorySpendChangeItem[];
  outliers: CategorySpendChangeItem[];
  subscriptions: Array<{
    name: string;
    category: string;
    current_amount: number;
    status: string;
    explanation: string;
  }>;
  spending_vs_plan: {
    actual_spending: number;
    planned_spending: number;
    variance: number;
  };
  goals_progress: Array<{
    goal_name: string;
    priority: string;
    current_amount: number;
    target_amount: number;
    planned_monthly_rate: number;
    actual_monthly_contribution: number;
    status: string;
    completion_forecast: string;
  }>;
  emergency_fund_status: {
    current_balance: number;
    target_amount: number;
    target_months: number;
    runway_actual_months: number;
  };
  suggested_actions: SuggestedActionItem[];
  narrative_summary: string;
}

