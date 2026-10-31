import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Info,
  CheckCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../api/client';
import { MonthlyReportData } from '../../api/types';

export const MonthlyReportPage: React.FC = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'subscriptions' | 'plan' | 'actions'>('categories');

  useEffect(() => {
    const fetchMonths = async () => {
      try {
        const res = await api.getReportMonths();
        setMonths(res.months);
        if (res.months.length > 0) {
          setSelectedMonth(res.months[res.months.length - 1]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMonths();
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    const fetchReport = async () => {
      try {
        setLoading(true);
        const data = await api.getMonthlyReport(selectedMonth);
        setReport(data);
      } catch (err: any) {
        alert(`Error generating report: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [selectedMonth]);

  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-xs text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Generating deterministic monthly review calculations...</p>
      </div>
    );
  }

  if (!report) return null;

  const { cash_flow } = report;

  // Comparison chart data
  const compData = [
    { metric: 'Income', Actual: cash_flow.income, '3M Baseline': cash_flow.trailing_3m_avg_income },
    { metric: 'Spending', Actual: cash_flow.spending, '3M Baseline': cash_flow.trailing_3m_avg_spending },
  ];

  // Category distribution data
  const catData = report.top_categories.slice(0, 6).map((c) => ({
    category: c.category,
    amount: c.current_spend,
  }));

  return (
    <div className="space-y-8">
      {/* Compliance Notice */}
      <div className="p-4 rounded-xl bg-amber-50/70 border-l-4 border-[#ff3b12] border-y border-r border-amber-200/80 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 text-[#ff3b12] shrink-0 mt-0.5" />
        <p className="font-mono text-xs text-[#64748b] leading-relaxed">
          <strong className="text-[#0f172a]">Educational Tool Notice:</strong> INARI monthly reviews model cash flows, historical pacing, and category trends. 
          This report is strictly educational and does not provide financial advice or recommend specific securities, stocks, funds, or crypto.
        </p>
      </div>

      {/* Header with Month Selector & Export Controls */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="font-archivo font-extrabold text-xl text-[#0f172a]">Monthly Review Report</h2>
          <p className="font-mono text-xs text-[#64748b] mt-1">
            Month-over-month telemetry, spending outliers, subscription audit, and goal pacing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Month Dropdown */}
          <div className="flex items-center gap-2 bg-[#f8fafc] border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-[#64748b]" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-[#0f172a] focus:outline-none cursor-pointer font-medium"
            >
              {months.map((m) => (
                <option key={m} value={m} className="bg-white text-[#0f172a]">
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Download HTML */}
          <a
            href={api.getReportHtmlUrl(selectedMonth)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[#0f172a] font-bold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[#ff3b12]" />
            <span>HTML Report</span>
          </a>

          {/* Download PDF */}
          <a
            href={api.getReportPdfUrl(selectedMonth)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#ff3b12] hover:bg-[#e0340f] text-white font-bold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Report</span>
          </a>
        </div>
      </div>

      {/* Primary Cash Flow KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Income */}
        <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">Total Income</div>
          <div className="text-xl font-archivo font-extrabold text-[#0f172a]">
            ₹{cash_flow.income.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#059669] font-medium">
            {cash_flow.income_mom_change !== undefined
              ? `${cash_flow.income_mom_change >= 0 ? '+' : ''}₹${cash_flow.income_mom_change.toLocaleString('en-IN')} MoM`
              : 'Initial Month'}
          </div>
        </div>

        {/* Spending */}
        <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">Total Spending</div>
          <div className="text-xl font-archivo font-extrabold text-[#0f172a]">
            ₹{cash_flow.spending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#dc2626] font-medium">
            {cash_flow.spending_mom_change !== undefined
              ? `${cash_flow.spending_mom_change >= 0 ? '+' : ''}₹${cash_flow.spending_mom_change.toLocaleString('en-IN')} MoM`
              : 'Initial Month'}
          </div>
        </div>

        {/* Net Savings */}
        <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">Net Savings</div>
          <div
            className={`text-xl font-archivo font-extrabold ${
              cash_flow.net_savings >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
            }`}
          >
            {cash_flow.net_savings >= 0 ? '+' : ''}₹
            {cash_flow.net_savings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#64748b]">
            3M Avg: ₹{cash_flow.trailing_3m_avg_savings.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Savings Rate */}
        <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">Savings Rate</div>
          <div className="text-xl font-archivo font-extrabold text-[#0f172a]">
            {cash_flow.savings_rate.toFixed(1)}%
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#64748b]">
            3M Avg: {cash_flow.trailing_3m_avg_savings_rate.toFixed(1)}%
          </div>
        </div>

        {/* Emergency Runway */}
        <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">Burn Runway</div>
          <div className="text-xl font-archivo font-extrabold text-[#0f172a]">
            {report.emergency_fund_status.runway_actual_months.toFixed(1)} mo
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#059669] font-medium">
            Reserves: ₹{report.emergency_fund_status.current_balance.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Executive Narrative Summary Box */}
      <div className="p-6 rounded-xl bg-[#f8fafc] border border-slate-200 space-y-2 font-mono text-xs shadow-sm">
        <div className="font-bold text-[#0f172a] uppercase tracking-wider text-[11px] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff3b12]" />
          <span>Executive Review Narrative ({report.month})</span>
        </div>
        <p className="text-[#334155] leading-relaxed text-sm">
          {report.narrative_summary}
        </p>
      </div>

      {/* Dual Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Actual vs 3M Trailing Baseline */}
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
          <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider">
            Actual Flow vs Trailing 3-Month Average
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11, fontFamily: 'monospace', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Bar dataKey="Actual" fill="#ff3b12" radius={[4, 4, 0, 0]} />
                <Bar dataKey="3M Baseline" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Categories Distribution */}
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
          <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider">
            Top Category Spending Breakdown
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="category" type="category" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11, fontFamily: 'monospace', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Spend']}
                />
                <Bar dataKey="amount" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-2 overflow-x-auto pb-1 font-mono text-xs">
        {[
          { id: 'categories', label: `Category Outliers (${report.top_categories.length})` },
          { id: 'subscriptions', label: `Subscriptions Audit (${report.subscriptions.length})` },
          { id: 'plan', label: 'Budget Plan & Goal Pacing' },
          { id: 'actions', label: `Suggested Actions (${report.suggested_actions.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-t-lg font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-[#ff3b12] border-t-2 border-[#ff3b12] shadow-sm border-x border-slate-200'
                : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Categories & Outliers */}
      {activeTab === 'categories' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-6 shadow-sm">
          {report.outliers.length > 0 && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-2">
              <div className="font-mono text-xs font-bold text-red-700 uppercase flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Detected Spending Outliers ({report.outliers.length})</span>
              </div>
              <div className="space-y-1 font-mono text-xs text-[#334155]">
                {report.outliers.map((out, i) => (
                  <div key={i}>
                    • <strong>{out.category}:</strong> ₹{out.current_spend.toLocaleString('en-IN')} — {out.outlier_reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-[#64748b] border-b border-[#e2e8f0] bg-slate-50">
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Current Spend</th>
                  <th className="py-2.5 px-3">MoM Shift</th>
                  <th className="py-2.5 px-3">3M Trailing Avg</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.top_categories.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-bold text-[#0f172a]">{c.category}</td>
                    <td className="py-3 px-3 text-[#0f172a]">₹{c.current_spend.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      {c.mom_change_amount !== undefined ? (
                        <span className={c.mom_change_amount > 0 ? 'text-[#dc2626]' : 'text-[#059669]'}>
                          {c.mom_change_amount >= 0 ? '+' : ''}₹{c.mom_change_amount.toLocaleString('en-IN')} (
                          {c.mom_change_percent?.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-[#94a3b8]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#64748b]">₹{c.trailing_3m_avg.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right">
                      {c.is_outlier ? (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                          ⚠️ Outlier
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[#64748b] border border-slate-200 text-[10px]">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Subscriptions Audit */}
      {activeTab === 'subscriptions' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-[#64748b] border-b border-[#e2e8f0] bg-slate-50">
                  <th className="py-2.5 px-3">Service / Merchant</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Audit Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.subscriptions.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-bold text-[#0f172a]">{s.name}</td>
                    <td className="py-3 px-3 text-[#64748b]">{s.category}</td>
                    <td className="py-3 px-3 text-[#0f172a] font-bold">₹{s.current_amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            s.status === 'Apparently Unused'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : s.status === 'Changed'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {s.status}
                        </span>
                        <span className="text-[11px] text-[#64748b]">{s.explanation}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Budget Plan & Goal Pacing */}
      {activeTab === 'plan' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono text-xs">
            <div className="p-4 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2 shadow-sm">
              <h4 className="font-bold text-[#0f172a] uppercase text-[11px]">Spending vs Baseline Plan</h4>
              <div className="flex justify-between text-[#64748b]">
                <span>Actual Spending:</span>
                <span className="text-[#0f172a]">₹{report.spending_vs_plan.actual_spending.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#64748b]">
                <span>Planned Baseline:</span>
                <span className="text-[#0f172a]">₹{report.spending_vs_plan.planned_spending.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-[#64748b]">Variance:</span>
                <span className={report.spending_vs_plan.variance <= 0 ? 'text-[#059669] font-bold' : 'text-[#dc2626] font-bold'}>
                  {report.spending_vs_plan.variance <= 0 ? 'Surplus' : 'Deficit'} (₹{Math.abs(report.spending_vs_plan.variance).toLocaleString('en-IN')})
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2 shadow-sm">
              <h4 className="font-bold text-[#0f172a] uppercase text-[11px]">Emergency Runway Pacing</h4>
              <div className="flex justify-between text-[#64748b]">
                <span>Reserve Balance:</span>
                <span className="text-[#0f172a]">₹{report.emergency_fund_status.current_balance.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[#64748b]">
                <span>Target Amount:</span>
                <span className="text-[#0f172a]">₹{report.emergency_fund_status.target_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-[#64748b]">Actual Burn Runway:</span>
                <span className="text-[#059669] font-bold">{report.emergency_fund_status.runway_actual_months.toFixed(1)} months</span>
              </div>
            </div>
          </div>

          <h4 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider pt-2">
            Goal Pacing Forecast
          </h4>
          <div className="space-y-3 font-mono text-xs">
            {report.goals_progress.map((gp, i) => (
              <div key={i} className="p-3.5 rounded-lg bg-[#f8fafc] border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <div className="text-[#0f172a] font-bold">{gp.goal_name}</div>
                  <div className="text-[10px] text-[#64748b]">{gp.completion_forecast}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[#0f172a]">₹{gp.current_amount.toLocaleString('en-IN')} / ₹{gp.target_amount.toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-[#64748b]">Rate: ₹{gp.planned_monthly_rate.toLocaleString('en-IN')}/mo</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      gp.status === 'On Track' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {gp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Suggested Educational Actions */}
      {activeTab === 'actions' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
          <p className="font-mono text-xs text-[#64748b]">
            Each suggested action is formulated as an educational what-if budget scenario that can be simulated directly in the Goal Planner.
          </p>
          <div className="space-y-4">
            {report.suggested_actions.map((act, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-[#f8fafc] border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 font-mono text-xs shadow-sm hover:border-slate-300 transition-all"
              >
                <div className="space-y-1">
                  <h4 className="font-archivo font-bold text-sm text-[#0f172a]">{act.title}</h4>
                  <p className="text-[#334155]">{act.description}</p>
                  <p className="text-[#64748b] text-[11px]">
                    <em>Rationale:</em> {act.rationale}
                  </p>
                  <div className="text-[#059669] font-bold mt-1">Benefit: {act.projected_benefit}</div>
                </div>
                <Link
                  to="/dashboard/planner"
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff3b12] hover:bg-[#e0340f] text-white font-bold transition-colors shadow-sm"
                >
                  <span>Simulate in Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
