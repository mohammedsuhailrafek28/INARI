import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  DollarSign,
  Lock,
  ShieldCheck,
  Target,
  History,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { FinancialProfileData, ProfileHistoryItem } from '../../api/types';

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<FinancialProfileData | null>(null);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'fixed' | 'emergency' | 'goals' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // New item modal states
  const [newIncSource, setNewIncSource] = useState('');
  const [newIncAmount, setNewIncAmount] = useState<number>(0);
  const [newIncFreq, setNewIncFreq] = useState('Monthly');

  const [newFcName, setNewFcName] = useState('');
  const [newFcCat, setNewFcCat] = useState('Other');
  const [newFcAmount, setNewFcAmount] = useState<number>(0);

  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState<number>(100000);
  const [newGoalCurrent, setNewGoalCurrent] = useState<number>(0);
  const [newGoalDate, setNewGoalDate] = useState('2028-12-31');
  const [newGoalPriority, setNewGoalPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  const [fundGoalName, setFundGoalName] = useState<string | null>(null);
  const [fundGoalAmount, setFundGoalAmount] = useState<number>(5000);

  const loadProfile = async (version?: number) => {
    try {
      setLoading(true);
      const [pData, hData] = await Promise.all([
        api.getProfile(version),
        api.getProfileHistory(),
      ]);
      setProfile(pData);
      setHistory(hData);
    } catch (err: any) {
      alert(`Error loading profile: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (summaryNote: string = 'Updated via Web Profile Manager') => {
    if (!profile) return;
    try {
      setSaving(true);
      setSaveSuccess(null);
      const updated = await api.updateProfile(profile, summaryNote);
      setProfile(updated);
      const newHistory = await api.getProfileHistory();
      setHistory(newHistory);
      setSaveSuccess(`Successfully saved as immutable profile Version ${updated.version}!`);
    } catch (err: any) {
      alert(`Failed to save profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddIncome = () => {
    if (!newIncSource.trim() || newIncAmount <= 0 || !profile) return;
    const newInc = {
      source: newIncSource.trim(),
      amount: newIncAmount,
      frequency: newIncFreq,
      monthly_amount: newIncAmount,
      confidence: 1.0,
      is_active: true,
    };
    const updated = { ...profile, income_sources: [...profile.income_sources, newInc] };
    setProfile(updated);
    setNewIncSource('');
    setNewIncAmount(0);
  };

  const handleAddFixedCost = () => {
    if (!newFcName.trim() || newFcAmount <= 0 || !profile) return;
    const newFc = {
      name: newFcName.trim(),
      category: newFcCat,
      amount: newFcAmount,
      frequency: 'monthly',
      monthly_amount: newFcAmount,
      is_recurring: true,
      confidence: 1.0,
    };
    const updated = { ...profile, fixed_costs: [...profile.fixed_costs, newFc] };
    setProfile(updated);
    setNewFcName('');
    setNewFcAmount(0);
  };

  const handleAddGoal = async () => {
    if (!newGoalName.trim() || newGoalTarget <= 0) return;
    try {
      const updated = await api.addGoal({
        name: newGoalName.trim(),
        target_amount: newGoalTarget,
        current_amount: newGoalCurrent,
        target_date: newGoalDate,
        priority: newGoalPriority,
      });
      setProfile(updated);
      const newHistory = await api.getProfileHistory();
      setHistory(newHistory);
      setNewGoalName('');
      alert(`Goal '${newGoalName}' added successfully!`);
    } catch (err: any) {
      alert(`Error adding goal: ${err.message}`);
    }
  };

  const handleFundGoal = async (goalName: string) => {
    if (fundGoalAmount <= 0) return;
    try {
      const updated = await api.fundGoal(goalName, fundGoalAmount);
      setProfile(updated);
      setFundGoalName(null);
      alert(`Contributed ₹${fundGoalAmount.toLocaleString('en-IN')} to ${goalName}!`);
    } catch (err: any) {
      alert(`Error contributing to goal: ${err.message}`);
    }
  };

  const handleDeleteGoal = async (goalName: string) => {
    if (!confirm(`Delete goal '${goalName}'?`)) return;
    try {
      const updated = await api.deleteGoal(goalName);
      setProfile(updated);
      const newHistory = await api.getProfileHistory();
      setHistory(newHistory);
      alert(`Goal '${goalName}' removed.`);
    } catch (err: any) {
      alert(`Error removing goal: ${err.message}`);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-xs text-[#64748b]">
        <div className="w-8 h-8 border-2 border-[#ff3b12] border-t-transparent rounded-full animate-spin" />
        <p>Loading living financial profile model...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Profile Header */}
      <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-archivo font-extrabold text-xl text-[#0f172a]">Living Financial Profile</h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-orange-50 text-[#ff3b12] border border-orange-200 font-bold">
              v{profile.version}
            </span>
          </div>
          <p className="font-mono text-xs text-[#64748b] mt-1">
            Source: <span className="text-[#0f172a] uppercase font-semibold">{profile.source}</span> · Last updated:{' '}
            <span className="text-[#0f172a]">{profile.updated_at.slice(0, 19).replace('T', ' ')} UTC</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSaveProfile('Committed profile changes in UI')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff3b12] hover:bg-[#e0340f] text-white font-mono text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Persisting...' : 'Save As New Version'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 font-mono text-xs text-[#059669]">
          <CheckCircle className="w-4 h-4" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-2 overflow-x-auto pb-1 font-mono text-xs">
        {[
          { id: 'overview', label: 'Architecture Overview' },
          { id: 'income', label: `Income (${profile.income_sources.length})` },
          { id: 'fixed', label: `Fixed Costs (${profile.fixed_costs.length})` },
          { id: 'emergency', label: 'Emergency Fund' },
          { id: 'goals', label: `Goals (${profile.goals.length})` },
          { id: 'history', label: `Version Audit (${history.length})` },
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

      {/* Tab 1: Architecture Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
            <h3 className="font-archivo font-bold text-sm text-[#64748b] uppercase">Income Streams</h3>
            <div className="text-3xl font-archivo font-extrabold text-[#0f172a]">
              ₹{profile.total_monthly_income.toLocaleString('en-IN')}
              <span className="text-xs text-[#64748b] font-mono font-normal"> /mo</span>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {profile.income_sources.map((inc, i) => (
                <div key={i} className="flex justify-between font-mono text-xs">
                  <span className="text-[#64748b]">{inc.source}</span>
                  <span className="text-[#0f172a] font-semibold">₹{inc.monthly_amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
            <h3 className="font-archivo font-bold text-sm text-[#64748b] uppercase">Fixed Commitments</h3>
            <div className="text-3xl font-archivo font-extrabold text-[#0f172a]">
              ₹{profile.total_monthly_fixed_costs.toLocaleString('en-IN')}
              <span className="text-xs text-[#64748b] font-mono font-normal"> /mo</span>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {profile.fixed_costs.slice(0, 5).map((fc, i) => (
                <div key={i} className="flex justify-between font-mono text-xs">
                  <span className="text-[#64748b]">{fc.name}</span>
                  <span className="text-[#0f172a] font-semibold">₹{fc.amount.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
            <h3 className="font-archivo font-bold text-sm text-[#64748b] uppercase">Net Cash Flow</h3>
            <div
              className={`text-3xl font-archivo font-extrabold ${
                profile.net_monthly_cash_flow >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
              }`}
            >
              {profile.net_monthly_cash_flow >= 0 ? '+' : ''}₹
              {profile.net_monthly_cash_flow.toLocaleString('en-IN')}
              <span className="text-xs text-[#64748b] font-mono font-normal"> /mo</span>
            </div>
            <p className="font-mono text-xs text-[#64748b] leading-relaxed pt-2 border-t border-slate-100">
              Discretionary surplus routed towards the emergency fund target and prioritized goal milestones.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Income Sources */}
      {activeTab === 'income' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-6 shadow-sm">
          <h3 className="font-archivo font-bold text-base text-[#0f172a]">Monthly Income Sources</h3>
          <div className="space-y-3">
            {profile.income_sources.map((inc, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-[#f8fafc] border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs shadow-sm"
              >
                <div>
                  <div className="text-[#0f172a] font-bold text-sm">{inc.source}</div>
                  <div className="text-[#64748b]">{inc.frequency} frequency</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[#0f172a] font-bold">₹{inc.amount.toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-[#64748b]">₹{inc.monthly_amount.toLocaleString('en-IN')}/mo</div>
                  </div>
                  <button
                    onClick={() => {
                      const updated = {
                        ...profile,
                        income_sources: profile.income_sources.filter((_, idx) => idx !== i),
                      };
                      setProfile(updated);
                    }}
                    className="p-1.5 rounded text-[#94a3b8] hover:text-[#ff3b12] hover:bg-slate-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Income Form */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#64748b] font-bold">
              Add Income Stream
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
              <input
                type="text"
                placeholder="Source name (e.g. Consulting)"
                value={newIncSource}
                onChange={(e) => setNewIncSource(e.target.value)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              />
              <input
                type="number"
                placeholder="Amount (₹)"
                value={newIncAmount || ''}
                onChange={(e) => setNewIncAmount(parseFloat(e.target.value) || 0)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              />
              <select
                value={newIncFreq}
                onChange={(e) => setNewIncFreq(e.target.value)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              >
                <option value="Monthly">Monthly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Weekly">Weekly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Irregular">Irregular</option>
              </select>
              <button
                type="button"
                onClick={handleAddIncome}
                className="px-4 py-2.5 rounded bg-[#0f172a] hover:bg-slate-800 text-white font-bold shadow-sm"
              >
                + Add Source
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Fixed Costs */}
      {activeTab === 'fixed' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-6 shadow-sm">
          <h3 className="font-archivo font-bold text-base text-[#0f172a]">Recurring Fixed Costs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.fixed_costs.map((fc, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-[#f8fafc] border border-slate-200 flex justify-between items-center font-mono text-xs shadow-sm"
              >
                <div>
                  <div className="text-[#0f172a] font-bold">{fc.name}</div>
                  <div className="text-[10px] text-[#64748b]">{fc.category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#0f172a] font-bold">₹{fc.amount.toLocaleString('en-IN')}</span>
                  <button
                    onClick={() => {
                      const updated = {
                        ...profile,
                        fixed_costs: profile.fixed_costs.filter((_, idx) => idx !== i),
                      };
                      setProfile(updated);
                    }}
                    className="p-1.5 rounded text-[#94a3b8] hover:text-[#ff3b12]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Fixed Cost */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#64748b] font-bold">
              Add Fixed Recurring Cost
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
              <input
                type="text"
                placeholder="Item name (e.g. Gym Membership)"
                value={newFcName}
                onChange={(e) => setNewFcName(e.target.value)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              />
              <select
                value={newFcCat}
                onChange={(e) => setNewFcCat(e.target.value)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              >
                <option value="Rent">Rent</option>
                <option value="Utilities">Utilities</option>
                <option value="EMIs">EMIs</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Other">Other</option>
              </select>
              <input
                type="number"
                placeholder="Monthly Amount (₹)"
                value={newFcAmount || ''}
                onChange={(e) => setNewFcAmount(parseFloat(e.target.value) || 0)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a] focus:outline-none focus:border-[#ff3b12]"
              />
              <button
                type="button"
                onClick={handleAddFixedCost}
                className="px-4 py-2.5 rounded bg-[#0f172a] hover:bg-slate-800 text-white font-bold shadow-sm"
              >
                + Add Cost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Emergency Fund */}
      {activeTab === 'emergency' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-6 shadow-sm">
          <h3 className="font-archivo font-bold text-base text-[#0f172a]">Emergency Buffer Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono text-xs">
            <div className="space-y-2">
              <label className="text-[#64748b] block font-medium">Current Reserve Balance (₹):</label>
              <input
                type="number"
                value={profile.emergency_fund.current_balance}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setProfile({
                    ...profile,
                    emergency_fund: {
                      ...profile.emergency_fund,
                      current_balance: val,
                      progress_pct:
                        profile.emergency_fund.target_amount > 0
                          ? (val / profile.emergency_fund.target_amount) * 100
                          : 100,
                    },
                  });
                }}
                className="w-full p-3 rounded-lg bg-white border border-slate-300 text-[#0f172a] font-bold text-sm shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[#64748b]">
                <span>Target Buffer:</span>
                <span className="text-[#0f172a] font-bold">{profile.emergency_fund.target_months} months of living costs</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                step="0.5"
                value={profile.emergency_fund.target_months}
                onChange={(e) => {
                  const months = parseFloat(e.target.value) || 6;
                  const tgt = months * profile.emergency_fund.monthly_expense_base;
                  setProfile({
                    ...profile,
                    emergency_fund: {
                      ...profile.emergency_fund,
                      target_months: months,
                      target_amount: tgt,
                      progress_pct: tgt > 0 ? (profile.emergency_fund.current_balance / tgt) * 100 : 100,
                    },
                  });
                }}
                className="w-full accent-[#ff3b12]"
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#f8fafc] border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs shadow-sm">
            <div>
              <span className="text-[#64748b] block text-[10px] uppercase font-semibold">Calculated Target:</span>
              <span className="text-[#0f172a] font-bold text-base">₹{profile.emergency_fund.target_amount.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[#64748b] block text-[10px] uppercase font-semibold">Monthly Living Base:</span>
              <span className="text-[#0f172a] font-bold text-base">₹{profile.emergency_fund.monthly_expense_base.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[#64748b] block text-[10px] uppercase font-semibold">Funded Level:</span>
              <span className="text-[#059669] font-bold text-base">{profile.emergency_fund.progress_pct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Goals */}
      {activeTab === 'goals' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-6 shadow-sm">
          <h3 className="font-archivo font-bold text-base text-[#0f172a]">Financial Goals Waterfall</h3>
          <div className="space-y-4">
            {profile.goals.map((g, i) => (
              <div key={i} className="p-4 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-3 font-mono text-xs shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#0f172a] font-bold text-sm">{g.name}</span>
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded font-bold border ${
                        g.priority === 'High'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : g.priority === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {g.priority}
                    </span>
                    {g.is_completed && <span className="text-[#059669] font-bold">✓ Met</span>}
                  </div>
                  <div className="text-[#64748b]">Deadline: {g.target_date}</div>
                </div>

                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#ff3b12] h-full rounded-full"
                    style={{ width: `${Math.min(100, g.progress_pct)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[#64748b]">
                  <span>
                    ₹{g.current_amount.toLocaleString('en-IN')} / ₹{g.target_amount.toLocaleString('en-IN')} (
                    {g.progress_pct.toFixed(1)}%)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFundGoalName(g.name)}
                      className="px-2.5 py-1 rounded bg-white border border-slate-300 text-[#0f172a] hover:bg-[#ff3b12] hover:text-white transition-colors shadow-sm font-medium"
                    >
                      + Fund
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(g.name)}
                      className="p-1 rounded text-[#94a3b8] hover:text-[#ff3b12]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {fundGoalName === g.name && (
                  <div className="mt-2 p-3 rounded bg-white border border-slate-200 flex items-center gap-3 shadow-sm">
                    <input
                      type="number"
                      value={fundGoalAmount}
                      onChange={(e) => setFundGoalAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Amount (₹)"
                      className="p-1.5 rounded bg-white border border-slate-300 text-[#0f172a] font-mono text-xs"
                    />
                    <button
                      onClick={() => handleFundGoal(g.name)}
                      className="px-3 py-1.5 rounded bg-[#ff3b12] text-white font-bold shadow-sm"
                    >
                      Contribute
                    </button>
                    <button
                      onClick={() => setFundGoalName(null)}
                      className="px-2 py-1.5 text-[#64748b] hover:text-[#0f172a]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Goal Form */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-[#64748b] font-bold">
              Add New Goal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
              <input
                type="text"
                placeholder="Goal name"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a]"
              />
              <input
                type="number"
                placeholder="Target (₹)"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(parseFloat(e.target.value) || 0)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a]"
              />
              <input
                type="date"
                value={newGoalDate}
                onChange={(e) => setNewGoalDate(e.target.value)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a]"
              />
              <select
                value={newGoalPriority}
                onChange={(e) => setNewGoalPriority(e.target.value as any)}
                className="p-2.5 rounded bg-white border border-slate-300 text-[#0f172a]"
              >
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
              <button
                type="button"
                onClick={handleAddGoal}
                className="px-4 py-2.5 rounded bg-[#ff3b12] text-white font-bold shadow-sm"
              >
                + Add Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Version History */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-xl bg-white border border-[#e2e8f0] space-y-4 shadow-sm">
          <h3 className="font-archivo font-bold text-base text-[#0f172a]">Immutable SQLite Audit Trail</h3>
          <div className="space-y-3 font-mono text-xs">
            {history.map((h) => (
              <div
                key={h.version}
                className={`p-4 rounded-lg border transition-all shadow-sm ${
                  h.version === profile.version
                    ? 'bg-orange-50/50 border-[#ff3b12]'
                    : 'bg-[#f8fafc] border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-[#0f172a]">Version {h.version}</span>
                  <span className="text-[#64748b]">{h.created_at.slice(0, 19).replace('T', ' ')}</span>
                </div>
                <div className="text-[#475569]">{h.summary}</div>
                {h.version !== profile.version && (
                  <button
                    onClick={() => loadProfile(h.version)}
                    className="mt-2 text-[#ff3b12] hover:underline text-[11px] font-bold"
                  >
                    Inspect Version {h.version} →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
