import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellRing,
  AlertTriangle,
  TrendingDown,
  Compass,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { NudgeItem } from '../../api/types';

export const NudgesPage: React.FC = () => {
  const [nudges, setNudges] = useState<NudgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchNudges = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getNudges();
      setNudges(res.nudges);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch spending nudges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNudges();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-xs text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Evaluating mid-month spending velocity & pacing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Explainer */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="font-archivo font-extrabold text-xl text-[#0f172a]">Spending Drifts & Pacing Nudges</h2>
          <p className="font-mono text-xs text-[#64748b] mt-1 max-w-2xl">
            Proactive early-warning alerts detecting category run-rates that exceed trailing 3-month baselines, 
            preventing month-end budget deficits before they occur.
          </p>
        </div>
        <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] font-mono text-xs text-[#0f172a]">
          <span className="text-[#64748b]">Active Alerts: </span>
          <span className="font-bold text-[#ff3b12]">{nudges.length}</span>
        </div>
      </div>

      {nudges.length === 0 ? (
        <div className="p-12 rounded-xl bg-white border border-[#e2e8f0] text-center max-w-lg mx-auto space-y-3 font-mono text-xs shadow-sm">
          <CheckCircle className="w-12 h-12 text-[#059669] mx-auto" />
          <h3 className="font-archivo font-bold text-base text-[#0f172a]">Spending Pacing Is Optimal</h3>
          <p className="text-[#64748b]">
            All discretionary spending categories are tracking comfortably within their trailing 3-month baseline bounds.
          </p>
          <Link
            to="/dashboard/planner"
            className="inline-block px-4 py-2 mt-2 rounded bg-[#ff3b12] text-white font-bold shadow-sm"
          >
            Open Goal Planner →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {nudges.map((nudge) => (
            <div
              key={nudge.id}
              className="p-6 rounded-xl bg-white border border-[#e2e8f0] hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl shrink-0 ${
                    nudge.severity === 'high'
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : nudge.severity === 'warning'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded font-bold border ${
                        nudge.severity === 'high'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {nudge.severity} Priority
                    </span>
                    <span className="font-mono text-xs text-[#64748b]">{nudge.category}</span>
                  </div>
                  <h3 className="text-base font-archivo font-bold text-[#0f172a]">{nudge.title}</h3>
                  <p className="font-mono text-xs text-[#475569] leading-relaxed max-w-2xl">
                    {nudge.message}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-auto">
                <Link
                  to="/dashboard/planner"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#ff3b12] hover:bg-[#e0340f] text-white font-mono text-xs font-bold transition-colors shadow-sm"
                >
                  <span>{nudge.action}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Educational Framework Box */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-3 font-mono text-xs shadow-sm">
        <div className="flex items-center gap-2 text-[#0f172a] font-bold uppercase tracking-wider text-[11px]">
          <Info className="w-4 h-4 text-[#ff3b12]" />
          <span>How INARI Computes Pacing Velocity</span>
        </div>
        <p className="text-[#64748b] leading-relaxed">
          Unlike static monthly budgets that only inform you after the month has closed, INARI calculates the day-of-month velocity relative to your trailing 3-month rolling median. When an expense category spikes by more than 15% above normal burn, a drift warning is triggered with an actionable scenario test.
        </p>
      </div>
    </div>
  );
};
