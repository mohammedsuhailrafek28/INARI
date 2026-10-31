import React, { useState, useEffect } from 'react';
import {
  Compass,
  TrendingUp,
  ShieldCheck,
  Target,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Sliders,
  DollarSign,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../api/client';
import {
  FinancialProfileData,
  GoalOutcomeItem,
  SimulationAdjustment,
  SimulationResponse,
  TimelineDataPoint,
} from '../../api/types';

export const PlannerPage: React.FC = () => {
  const [profile, setProfile] = useState<FinancialProfileData | null>(null);
  const [horizonMonths, setHorizonMonths] = useState<number>(24);

  // Scenario Adjustments State
  const [diningCut, setDiningCut] = useState<number>(0);
  const [travelCut, setTravelCut] = useState<number>(0);
  const [shoppingCut, setShoppingCut] = useState<number>(0);

  const [rentHike, setRentHike] = useState<number>(0);
  const [salaryRaise, setSalaryRaise] = useState<number>(0);
  const [extraIncome, setExtraIncome] = useState<number>(0);

  const [newRecName, setNewRecName] = useState<string>('');
  const [newRecAmt, setNewRecAmt] = useState<number>(0);
  const [newRecMonth, setNewRecMonth] = useState<number>(1);

  const [oneTimeName, setOneTimeName] = useState<string>('');
  const [oneTimeAmt, setOneTimeAmt] = useState<number>(0);
  const [oneTimeMonth, setOneTimeMonth] = useState<number>(3);

  // Simulation output state
  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Load initial profile
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const p = await api.getProfile();
        setProfile(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Compute active adjustments list
  const getActiveAdjustments = (): SimulationAdjustment[] => {
    const adjs: SimulationAdjustment[] = [];

    if (diningCut !== 0) {
      adjs.push({ adjustment_type: 'category_spend', target: 'Food & Dining', value: diningCut, change_type: 'percent' });
    }
    if (travelCut !== 0) {
      adjs.push({ adjustment_type: 'category_spend', target: 'Travel', value: travelCut, change_type: 'percent' });
    }
    if (shoppingCut !== 0) {
      adjs.push({ adjustment_type: 'category_spend', target: 'Shopping', value: shoppingCut, change_type: 'percent' });
    }
    if (rentHike !== 0) {
      adjs.push({ adjustment_type: 'fixed_cost', target: 'House Rent', value: rentHike, change_type: 'percent' });
    }
    if (salaryRaise > 0) {
      adjs.push({ adjustment_type: 'income', target: 'Salary Credit', value: salaryRaise, change_type: 'percent' });
    }
    if (extraIncome > 0) {
      adjs.push({ adjustment_type: 'income', target: 'Extra Consulting', value: extraIncome, change_type: 'amount' });
    }
    if (newRecName.trim() && newRecAmt > 0) {
      adjs.push({ adjustment_type: 'new_recurring', target: newRecName.trim(), value: newRecAmt, change_type: 'amount', start_month: newRecMonth });
    }
    if (oneTimeName.trim() && oneTimeAmt > 0) {
      adjs.push({ adjustment_type: 'one_time_expense', target: oneTimeName.trim(), value: oneTimeAmt, change_type: 'amount', start_month: oneTimeMonth });
    }

    return adjs;
  };

  // Run simulation whenever adjustments or horizon changes
  useEffect(() => {
    if (!profile) return;
    const runSim = async () => {
      try {
        setSimulating(true);
        const adjs = getActiveAdjustments();
        const res = await api.simulateScenario(horizonMonths, adjs);
        setSimResult(res);
      } catch (err: any) {
        console.error('Simulation error', err);
      } finally {
        setSimulating(false);
      }
    };

    const timer = setTimeout(runSim, 200);
    return () => clearTimeout(timer);
  }, [horizonMonths, diningCut, travelCut, shoppingCut, rentHike, salaryRaise, extraIncome, newRecName, newRecAmt, newRecMonth, oneTimeName, oneTimeAmt, oneTimeMonth, profile]);

  const handleReset = () => {
    setDiningCut(0);
    setTravelCut(0);
    setShoppingCut(0);
    setRentHike(0);
    setSalaryRaise(0);
    setExtraIncome(0);
    setNewRecName('');
    setNewRecAmt(0);
    setOneTimeName('');
    setOneTimeAmt(0);
  };

  const handleCommitScenario = async () => {
    if (!confirm('Save this what-if scenario as a new active profile version in the permanent database?')) return;
    try {
      setSavingProfile(true);
      const adjs = getActiveAdjustments();
      const updated = await api.commitScenario(horizonMonths, adjs);
      setProfile(updated);
      setSaveSuccess(`Scenario successfully committed as active profile Version ${updated.version}!`);
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err: any) {
      alert(`Error saving scenario: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-xs text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Initializing simulation engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Compliance Notice */}
      <div className="p-4 rounded-xl bg-amber-50/70 border-l-4 border-[#ff3b12] border-y border-r border-amber-200/80 flex items-start gap-3 shadow-sm">
        <Info className="w-5 h-5 text-[#ff3b12] shrink-0 mt-0.5" />
        <p className="font-mono text-xs text-[#64748b] leading-relaxed">
          <strong className="text-[#0f172a]">Educational Scenario Modeling:</strong> INARI models cash flows, discretionary trade-offs, and goal trajectories. 
          INARI strictly models scenarios and never recommends specific securities, stocks, funds, or crypto.
        </p>
      </div>

      {/* Preset Quick Actions */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
          <div>
            <h2 className="font-archivo font-bold text-base text-[#0f172a]">⚡ Quick Scenario Presets</h2>
            <p className="font-mono text-xs text-[#64748b]">Test common financial stress tests with one click.</p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-[#475569] hover:text-[#0f172a] font-mono text-xs transition-colors self-start sm:self-auto border border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
          <button
            onClick={() => { handleReset(); setDiningCut(-30); }}
            className={`p-3 rounded-lg border text-left transition-all shadow-sm ${
              diningCut === -30 && rentHike === 0
                ? 'bg-orange-50 border-[#ff3b12] text-[#0f172a] font-bold'
                : 'bg-[#f8fafc] border-slate-200 text-[#475569] hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-bold text-[#0f172a] mb-0.5">🍕 Cut Dining by 30%</div>
            <div className="text-[10px] text-[#64748b]">Reclaim monthly restaurant spend</div>
          </button>

          <button
            onClick={() => { handleReset(); setRentHike(10); }}
            className={`p-3 rounded-lg border text-left transition-all shadow-sm ${
              rentHike === 10 && diningCut === 0
                ? 'bg-orange-50 border-[#ff3b12] text-[#0f172a] font-bold'
                : 'bg-[#f8fafc] border-slate-200 text-[#475569] hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-bold text-[#0f172a] mb-0.5">📈 Rent Up 10%</div>
            <div className="text-[10px] text-[#64748b]">Simulate lease escalation shock</div>
          </button>

          <button
            onClick={() => { handleReset(); setDiningCut(-30); setRentHike(10); }}
            className={`p-3 rounded-lg border text-left transition-all shadow-sm ${
              diningCut === -30 && rentHike === 10
                ? 'bg-orange-50 border-[#ff3b12] text-[#0f172a] font-bold'
                : 'bg-[#f8fafc] border-slate-200 text-[#475569] hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-bold text-[#0f172a] mb-0.5">⚖️ Cut Dining 30% + Rent 10%</div>
            <div className="text-[10px] text-[#64748b]">Offset rent inflation by cutting dining</div>
          </button>

          <button
            onClick={() => { handleReset(); setSalaryRaise(15); }}
            className={`p-3 rounded-lg border text-left transition-all shadow-sm ${
              salaryRaise === 15
                ? 'bg-orange-50 border-[#ff3b12] text-[#0f172a] font-bold'
                : 'bg-[#f8fafc] border-slate-200 text-[#475569] hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-bold text-[#0f172a] mb-0.5">💼 15% Salary Hike</div>
            <div className="text-[10px] text-[#64748b]">Project career acceleration</div>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid: Controls on Left, Visuals & Outcomes on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#ff3b12]" />
                <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider">
                  Scenario Parameters
                </h3>
              </div>
              <div className="font-mono text-xs text-[#64748b]">
                Horizon: <span className="text-[#0f172a] font-bold">{horizonMonths} Mo</span>
              </div>
            </div>

            {/* Projection Horizon Slider */}
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-[#64748b]">
                <span>Simulation Horizon:</span>
                <span className="text-[#0f172a] font-medium">{horizonMonths} months</span>
              </div>
              <input
                type="range"
                min="12"
                max="60"
                step="6"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(parseInt(e.target.value) || 24)}
                className="w-full accent-[#ff3b12]"
              />
            </div>

            {/* Variable Category Spending Adjustments */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#ff3b12] font-bold">
                Category Spending Adjustments (%)
              </div>

              {/* Food & Dining */}
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Food & Dining:</span>
                  <span className={`font-bold ${diningCut < 0 ? 'text-[#059669]' : diningCut > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                    {diningCut > 0 ? `+${diningCut}` : diningCut}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={diningCut}
                  onChange={(e) => setDiningCut(parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#ff3b12]"
                />
              </div>

              {/* Travel */}
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Travel & Vacations:</span>
                  <span className={`font-bold ${travelCut < 0 ? 'text-[#059669]' : travelCut > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                    {travelCut > 0 ? `+${travelCut}` : travelCut}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="50"
                  step="5"
                  value={travelCut}
                  onChange={(e) => setTravelCut(parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#ff3b12]"
                />
              </div>

              {/* Shopping */}
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Discretionary Shopping:</span>
                  <span className={`font-bold ${shoppingCut < 0 ? 'text-[#059669]' : shoppingCut > 0 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                    {shoppingCut > 0 ? `+${shoppingCut}` : shoppingCut}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={shoppingCut}
                  onChange={(e) => setShoppingCut(parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#ff3b12]"
                />
              </div>
            </div>

            {/* Fixed Cost & Rent */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#ff3b12] font-bold">
                Fixed Costs & Rent Escalation
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">House Rent Adjustment:</span>
                  <span className={`font-bold ${rentHike > 0 ? 'text-[#dc2626]' : rentHike < 0 ? 'text-[#059669]' : 'text-[#0f172a]'}`}>
                    {rentHike > 0 ? `+${rentHike}` : rentHike}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="5"
                  value={rentHike}
                  onChange={(e) => setRentHike(parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#ff3b12]"
                />
              </div>
            </div>

            {/* Income Changes */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#ff3b12] font-bold">
                Income Modifications
              </div>
              <div className="space-y-1 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748b]">Salary Raise:</span>
                  <span className="text-[#059669] font-bold">+{salaryRaise}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="2.5"
                  value={salaryRaise}
                  onChange={(e) => setSalaryRaise(parseFloat(e.target.value) || 0)}
                  className="w-full accent-[#059669]"
                />
              </div>
              <div className="space-y-1 font-mono text-xs">
                <label className="text-[#64748b] block">Extra Monthly Consulting (₹):</label>
                <input
                  type="number"
                  step="5000"
                  value={extraIncome || ''}
                  placeholder="0"
                  onChange={(e) => setExtraIncome(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
                />
              </div>
            </div>

            {/* One-Time & Recurring Expenses */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#ff3b12] font-bold">
                One-Time Lump Sum in Month N
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <input
                  type="text"
                  placeholder="e.g. Laptop Upgrade"
                  value={oneTimeName}
                  onChange={(e) => setOneTimeName(e.target.value)}
                  className="p-2 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
                />
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={oneTimeAmt || ''}
                  onChange={(e) => setOneTimeAmt(parseFloat(e.target.value) || 0)}
                  className="p-2 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7 space-y-6">
          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 font-mono text-xs text-[#059669] shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {simResult && (
            <>
              {/* Diff KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
                  <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">
                    Monthly Flow Shift
                  </div>
                  <div
                    className={`text-xl font-archivo font-extrabold ${
                      simResult.monthly_cash_flow_diff >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
                    }`}
                  >
                    {simResult.monthly_cash_flow_diff >= 0 ? '+' : ''}₹
                    {simResult.monthly_cash_flow_diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    <span className="text-[10px] font-normal text-[#64748b]"> /mo</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
                  <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">
                    {horizonMonths}-Mo Net Savings Delta
                  </div>
                  <div
                    className={`text-xl font-archivo font-extrabold ${
                      simResult.final_savings_diff >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
                    }`}
                  >
                    {simResult.final_savings_diff >= 0 ? '+' : ''}₹
                    {simResult.final_savings_diff.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-sm">
                  <div className="text-[10px] font-mono uppercase text-[#64748b] mb-1 font-medium">
                    Runway Shift
                  </div>
                  <div
                    className={`text-xl font-archivo font-extrabold ${
                      simResult.emergency_runway_diff >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
                    }`}
                  >
                    {simResult.emergency_runway_diff >= 0 ? '+' : ''}
                    {simResult.emergency_runway_diff.toFixed(1)} mo
                  </div>
                </div>
              </div>

              {/* Plain-Language Executive Summary Box */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-2 shadow-sm">
                <div className="font-bold text-[#0f172a] uppercase tracking-wider text-[11px] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff3b12]" />
                  <span>Executive What-If Summary</span>
                </div>
                <p className="text-[#334155] leading-relaxed">
                  {simResult.plain_language_summary}
                </p>
              </div>

              {/* Savings Trajectory Chart */}
              <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider">
                    Savings Trajectory (Baseline vs What-If)
                  </h3>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5 text-[#64748b]">
                      <span className="w-3 h-0.5 bg-slate-400" />
                      <span>Baseline</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#ff3b12]">
                      <span className="w-3 h-0.5 bg-[#ff3b12]" />
                      <span>What-If Scenario</span>
                    </div>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={simResult.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', fontSize: 11, fontFamily: 'monospace', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                        formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                      />
                      <Line type="monotone" dataKey="baseline_savings" name="Baseline Savings" stroke="#94a3b8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="scenario_savings" name="What-If Savings" stroke="#ff3b12" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Goal Outcomes Matrix */}
              <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
                <h3 className="font-archivo font-bold text-sm text-[#0f172a] uppercase tracking-wider">
                  Goal Outcomes: Baseline vs Scenario
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-[#64748b] border-b border-[#e2e8f0] bg-slate-50">
                        <th className="py-2.5 px-3">Goal</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Target Date</th>
                        <th className="py-2.5 px-3">Baseline</th>
                        <th className="py-2.5 px-3">Scenario</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3 text-right">Feasibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {simResult.goal_outcomes.map((g, i) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-bold text-[#0f172a]">{g.goal_name}</td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] text-[#64748b]">{g.priority}</span>
                          </td>
                          <td className="py-3 px-3 text-[#64748b]">{g.target_date}</td>
                          <td className="py-3 px-3 text-[#475569]">{g.baseline_status}</td>
                          <td className="py-3 px-3 text-[#0f172a] font-semibold">{g.scenario_status}</td>
                          <td className="py-3 px-3">
                            {g.completion_shift_months ? (
                              <span className={g.completion_shift_months > 0 ? 'text-[#059669]' : 'text-[#dc2626]'}>
                                {g.completion_shift_months > 0 ? `+${g.completion_shift_months} mo earlier` : `${g.completion_shift_months} mo late`}
                              </span>
                            ) : (
                              <span className="text-[#94a3b8]">No shift</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {g.is_infeasible_scenario ? (
                              <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                                ❌ Infeasible
                              </span>
                            ) : g.scenario_status === 'On Track' ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                ✅ Achievable
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                ⚠️ At Risk
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Commit Scenario to Profile Button */}
              <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  <h4 className="font-archivo font-bold text-sm text-[#0f172a]">Save as Active Profile</h4>
                  <p className="font-mono text-xs text-[#64748b]">
                    Scenarios are strictly non-destructive unless you commit them into SQLite as a new immutable version.
                  </p>
                </div>
                <button
                  onClick={handleCommitScenario}
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-lg bg-[#ff3b12] hover:bg-[#e0340f] text-white font-mono text-xs font-bold transition-colors shrink-0 disabled:opacity-50 shadow-sm"
                >
                  {savingProfile ? 'Saving Version...' : 'Save As New Profile Version'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
