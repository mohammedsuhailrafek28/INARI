import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Target,
  AlertTriangle,
  Receipt,
  Plus,
  Compass,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../api/client';
import { OverviewData } from '../../api/types';

export const OverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 font-mono text-sm text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Loading your living money model...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-xl bg-white border border-red-200 text-center max-w-lg mx-auto shadow-sm">
        <AlertTriangle className="w-10 h-10 text-[#ff3b12] mx-auto mb-3" />
        <h3 className="text-lg font-archivo font-bold text-[#0f172a] mb-2">Failed to Load Overview</h3>
        <p className="text-xs font-mono text-[#64748b] mb-6">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-[#ff3b12] text-white font-mono text-xs font-bold rounded shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    monthly_inflow,
    monthly_outflow,
    net_cash_flow,
    savings_rate,
    emergency_runway_months,
    emergency_fund,
    goals,
    active_nudges,
    recent_transactions,
  } = data;

  const completedGoals = goals.filter((g) => g.is_completed).length;

  return (
    <div className="space-y-8">
      {/* Active Nudges Alert Banner (if any) */}
      {active_nudges && active_nudges.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-lg bg-amber-100 text-[#ff3b12] shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                  Active Drift Alert
                </span>
                <span className="font-mono text-xs text-[#64748b]">{active_nudges[0].category}</span>
              </div>
              <p className="text-sm font-semibold text-[#0f172a] mt-1">
                {active_nudges[0].message}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/nudges"
            className="shrink-0 flex items-center gap-1.5 font-mono text-xs font-bold text-[#ff3b12] hover:text-white transition-colors px-3 py-1.5 rounded border border-[#ff3b12] bg-white hover:bg-[#ff3b12] shadow-sm"
          >
            <span>Review & Simulate</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Net Monthly Flow */}
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] hover:border-slate-300 transition-all shadow-sm">
          <div className="flex items-center justify-between font-mono text-xs text-[#64748b] mb-3">
            <span>Net Monthly Flow</span>
            <TrendingUp className="w-4 h-4 text-[#64748b]" />
          </div>
          <div className={`text-2xl sm:text-3xl font-archivo font-extrabold tracking-tight ${net_cash_flow >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
            {net_cash_flow >= 0 ? '+' : ''}₹{net_cash_flow.toLocaleString('en-IN')}
          </div>
          <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex justify-between font-mono text-[11px] text-[#64748b]">
            <span>Inflow: ₹{monthly_inflow.toLocaleString('en-IN')}</span>
            <span>Spend: ₹{monthly_outflow.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] hover:border-slate-300 transition-all shadow-sm">
          <div className="flex items-center justify-between font-mono text-xs text-[#64748b] mb-3">
            <span>Savings Rate</span>
            <span className="font-mono text-[10px] text-[#64748b]">Monthly Surplus</span>
          </div>
          <div className="text-2xl sm:text-3xl font-archivo font-extrabold tracking-tight text-[#0f172a]">
            {savings_rate.toFixed(1)}%
          </div>
          <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex items-center justify-between font-mono text-[11px] text-[#64748b]">
            <span>Target Benchmark</span>
            <span className="text-[#059669] font-medium">20.0%+ (Healthy)</span>
          </div>
        </div>

        {/* Emergency Runway */}
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] hover:border-slate-300 transition-all shadow-sm">
          <div className="flex items-center justify-between font-mono text-xs text-[#64748b] mb-3">
            <span>Emergency Runway</span>
            <ShieldCheck className="w-4 h-4 text-[#64748b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-archivo font-extrabold tracking-tight text-[#0f172a]">
            {emergency_runway_months.toFixed(1)}{' '}
            <span className="text-sm font-normal text-[#64748b]">months</span>
          </div>
          <div className="mt-4 pt-4 border-t border-[#e2e8f0] space-y-1.5">
            <div className="flex justify-between font-mono text-[10px] text-[#64748b]">
              <span>Funded: {emergency_fund.progress_pct.toFixed(0)}%</span>
              <span>Target: {emergency_fund.target_months} mos</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-[#059669] h-full rounded-full"
                style={{ width: `${Math.min(100, emergency_fund.progress_pct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Goals Progress */}
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] hover:border-slate-300 transition-all shadow-sm">
          <div className="flex items-center justify-between font-mono text-xs text-[#64748b] mb-3">
            <span>Financial Goals</span>
            <Target className="w-4 h-4 text-[#64748b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-archivo font-extrabold tracking-tight text-[#0f172a]">
            {completedGoals}{' '}
            <span className="text-sm font-normal text-[#64748b]">/ {goals.length} Met</span>
          </div>
          <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex items-center justify-between font-mono text-[11px] text-[#64748b]">
            <span>Active Priorities</span>
            <span className="text-[#ff3b12] font-semibold">{goals.length - completedGoals} in progress</span>
          </div>
        </div>
      </div>

      {/* Mid Section: Active Goals & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Goals Waterfall Card */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#e2e8f0]">
            <div>
              <h2 className="font-archivo font-bold text-lg text-[#0f172a]">Goal Allocation Waterfall</h2>
              <p className="font-mono text-xs text-[#64748b]">
                Monthly positive surplus is routed sequentially by priority (High → Medium → Low).
              </p>
            </div>
            <Link
              to="/dashboard/profile"
              className="font-mono text-xs text-[#ff3b12] hover:text-[#d02e0b] flex items-center gap-1 transition-colors font-medium"
            >
              <span>Manage Goals</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {goals.map((goal, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0f172a] text-sm">{goal.name}</span>
                    <span
                      className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
                        goal.priority === 'High'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : goal.priority === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {goal.priority}
                    </span>
                    {goal.is_completed && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-[#059669] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Met
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-[#64748b]">
                    Target: <span className="text-[#0f172a] font-medium">{goal.target_date}</span>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1.5 mt-3">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-[#64748b]">
                      ₹{goal.current_amount.toLocaleString('en-IN')} of ₹{goal.target_amount.toLocaleString('en-IN')}
                    </span>
                    <span className="font-bold text-[#0f172a]">{goal.progress_pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        goal.is_completed ? 'bg-[#059669]' : 'bg-[#ff3b12]'
                      }`}
                      style={{ width: `${Math.min(100, goal.progress_pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions & Model Health */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
            <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider mb-4">
              Action Center
            </h3>
            <div className="space-y-2.5">
              <Link
                to="/dashboard/transactions"
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-4 h-4 text-[#ff3b12]" />
                  <span className="font-mono text-xs text-[#0f172a] font-medium">Import Statements</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748b] group-hover:text-[#0f172a] transition-colors" />
              </Link>

              <Link
                to="/dashboard/planner"
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Compass className="w-4 h-4 text-[#ff3b12]" />
                  <span className="font-mono text-xs text-[#0f172a] font-medium">Simulate What-If</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748b] group-hover:text-[#0f172a] transition-colors" />
              </Link>

              <Link
                to="/dashboard/reports"
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="w-4 h-4 text-[#ff3b12]" />
                  <span className="font-mono text-xs text-[#0f172a] font-medium">Monthly Review</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#64748b] group-hover:text-[#0f172a] transition-colors" />
              </Link>
            </div>
          </div>

          {/* Model Integrity Snapshot */}
          <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] space-y-3 font-mono text-xs shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">
              Living Model Metadata
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>Profile Version:</span>
              <span className="text-[#0f172a] font-bold">v{data.profile_version}</span>
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>Ingestion Source:</span>
              <span className="text-[#0f172a] uppercase font-medium">{data.profile_source}</span>
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>Last Recalculated:</span>
              <span className="text-[#0f172a]">{data.profile_updated_at.slice(0, 10)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Transactions Feed */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#e2e8f0]">
          <div>
            <h3 className="font-archivo font-bold text-base text-[#0f172a]">Recent Transactions</h3>
            <p className="font-mono text-xs text-[#64748b]">Latest activity parsed into the ledger.</p>
          </div>
          <Link
            to="/dashboard/transactions"
            className="font-mono text-xs text-[#ff3b12] hover:text-[#d02e0b] flex items-center gap-1 transition-colors font-medium"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-[#64748b] bg-slate-50 border-b border-[#e2e8f0]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent_transactions.map((tx) => (
                <tr key={tx.TransactionID} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-[#64748b]">{tx.TransactionDate}</td>
                  <td className="py-3 px-3 text-[#0f172a] font-semibold">{tx.Description}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-[#475569] border border-slate-200 text-[10px]">
                      {tx.Category}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold ${
                        tx.TransactionType.toLowerCase() === 'income' ? 'text-[#059669]' : 'text-[#64748b]'
                      }`}
                    >
                      {tx.TransactionType}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-bold ${
                      tx.TransactionType.toLowerCase() === 'income' ? 'text-[#059669]' : 'text-[#0f172a]'
                    }`}
                  >
                    {tx.TransactionType.toLowerCase() === 'income' ? '+' : '-'}₹
                    {tx.Amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
