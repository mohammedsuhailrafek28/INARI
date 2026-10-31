import React, { useState, useEffect } from 'react';
import {
  Repeat,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Info,
  Calendar,
  DollarSign,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { SubscriptionItem } from '../../api/types';

export const SubscriptionsPage: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [sentinelHeuristic, setSentinelHeuristic] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSubscriptions();
      setSubscriptions(res.subscriptions);
      setSentinelHeuristic(res.sentinel_heuristic);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const totalMonthlyCommitments = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const unusedCount = subscriptions.filter((s) => s.is_unused).length;
  const priceHikesCount = subscriptions.filter((s) => s.is_price_hike).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-xs text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Scanning recurring cadences and subscription signals...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="flex justify-between items-center text-xs font-mono text-[#64748b] mb-2 font-medium">
            <span>Total Recurring Commitments</span>
            <Repeat className="w-4 h-4 text-[#64748b]" />
          </div>
          <div className="text-2xl sm:text-3xl font-archivo font-extrabold text-[#0f172a]">
            ₹{totalMonthlyCommitments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            <span className="text-xs font-normal text-[#64748b] font-mono"> /mo</span>
          </div>
          <p className="font-mono text-[11px] text-[#64748b] mt-3">
            {subscriptions.length} detected recurring services & bills
          </p>
        </div>

        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="flex justify-between items-center text-xs font-mono text-[#64748b] mb-2 font-medium">
            <span>Unused Sentinel Flags</span>
            <ShieldAlert className="w-4 h-4 text-[#d97706]" />
          </div>
          <div className="text-2xl sm:text-3xl font-archivo font-extrabold text-[#d97706]">
            {unusedCount}
            <span className="text-xs font-normal text-[#64748b] font-mono"> flagged</span>
          </div>
          <p className="font-mono text-[11px] text-[#64748b] mt-3">
            Charges observed with zero complementary category usage
          </p>
        </div>

        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
          <div className="flex justify-between items-center text-xs font-mono text-[#64748b] mb-2 font-medium">
            <span>Rate Hike Alerts</span>
            <TrendingUp className="w-4 h-4 text-[#ff3b12]" />
          </div>
          <div className="text-2xl sm:text-3xl font-archivo font-extrabold text-[#ff3b12]">
            {priceHikesCount}
            <span className="text-xs font-normal text-[#64748b] font-mono"> shifted</span>
          </div>
          <p className="font-mono text-[11px] text-[#64748b] mt-3">
            Amount increased or shifted by &gt;5% vs baseline
          </p>
        </div>
      </div>

      {/* Unused Sentinel Heuristic Explainer Banner */}
      <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-4 shadow-sm">
        <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1 font-mono text-xs">
          <div className="font-bold text-[#0f172a] uppercase tracking-wider text-[11px]">
            The "Apparently Unused" Subscription Heuristic
          </div>
          <p className="text-[#475569] leading-relaxed">
            {sentinelHeuristic || (
              "A recurring subscription is tagged as 'Apparently Unused' when recurring fees were debited, " +
              "but zero complementary user transactions or activity were observed in that category during the entire month. " +
              "Review these for immediate budget reclamation."
            )}
          </p>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#e2e8f0]">
          <div>
            <h2 className="font-archivo font-bold text-lg text-[#0f172a]">Detected Subscriptions & Recurring Bills</h2>
            <p className="font-mono text-xs text-[#64748b]">
              Continuous audit of auto-debits, recurring EMI commitments, and discretionary software/streaming services.
            </p>
          </div>
          <Link
            to="/dashboard/planner"
            className="font-mono text-xs text-[#ff3b12] hover:text-[#d02e0b] flex items-center gap-1.5 transition-colors font-bold"
          >
            <span>Simulate Subscription Cuts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-[#64748b] border-b border-[#e2e8f0] bg-slate-50">
                <th className="py-3 px-4">Service / Merchant</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Cadence</th>
                <th className="py-3 px-4">Next Expected Charge</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status & Audit Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions.map((sub, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4 font-bold text-[#0f172a]">{sub.name}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-[#475569] border border-slate-200 text-[10px]">
                      {sub.category}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#64748b]">{sub.cadence}</td>
                  <td className="py-4 px-4 text-[#64748b]">{sub.next_charge_date}</td>
                  <td className="py-4 px-4 text-right font-bold text-[#0f172a]">
                    ₹{sub.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {sub.is_unused ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                            ⚠️ Apparently Unused
                          </span>
                        ) : sub.is_price_hike ? (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                            📈 Price Changed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            ✓ {sub.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748b] max-w-sm">
                        {sub.explanation}
                      </div>
                    </div>
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
