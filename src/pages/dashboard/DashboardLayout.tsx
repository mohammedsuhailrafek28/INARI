import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Repeat,
  UserCheck,
  Compass,
  BellRing,
  FileText,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  Menu,
  X,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../api/client';
import { OverviewData } from '../../api/types';

export const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [rederiving, setRederiving] = useState(false);

  const fetchOverview = async () => {
    try {
      const data = await api.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load overview data', err);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [location.pathname]);

  const handleRederive = async () => {
    if (confirm('Re-derive your living financial profile deterministically from transactions?')) {
      try {
        setRederiving(true);
        await api.rederiveProfile();
        await fetchOverview();
        alert('Profile re-derived successfully!');
      } catch (err: any) {
        alert(`Error re-deriving profile: ${err.message}`);
      } finally {
        setRederiving(false);
      }
    }
  };

  const navItems = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'AI Advisor & Health', path: '/dashboard/advisor', icon: Compass },
    { label: 'Ingestion & Ledger', path: '/dashboard/transactions', icon: Receipt },
    { label: 'Subscriptions', path: '/dashboard/subscriptions', icon: Repeat },
    { label: 'Living Profile', path: '/dashboard/profile', icon: UserCheck },
    { label: 'Goal Planner', path: '/dashboard/planner', icon: Compass },
    { label: 'Spending Nudges', path: '/dashboard/nudges', icon: BellRing, badge: overview?.active_nudges_count },
    { label: 'Monthly Review', path: '/dashboard/reports', icon: FileText },
  ];

  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return { title: 'Executive Overview', desc: 'Real-time financial vitals & goal pacing' };
    if (location.pathname.startsWith('/dashboard/advisor')) return { title: 'AI Advisor & Health Assessment', desc: 'Financial health score 0-100 & contextual conversational coach' };
    if (location.pathname.startsWith('/dashboard/transactions')) return { title: 'Import & Transactions', desc: 'Ingestion engine & category correction loop' };
    if (location.pathname.startsWith('/dashboard/subscriptions')) return { title: 'Subscriptions & Recurring', desc: 'Cadence detection & unused subscription sentinel' };
    if (location.pathname.startsWith('/dashboard/profile')) return { title: 'Living Financial Profile', desc: 'Immutable versioned financial model' };
    if (location.pathname.startsWith('/dashboard/planner')) return { title: 'Goal Planner & Simulation', desc: 'What-if budget modeling & waterfall goal engine' };
    if (location.pathname.startsWith('/dashboard/nudges')) return { title: 'Spending Nudges', desc: 'Mid-month velocity alerts & category drift warnings' };
    if (location.pathname.startsWith('/dashboard/reports')) return { title: 'Monthly Review Report', desc: 'Automated monthly review & exportable reports' };
    return { title: 'Dashboard', desc: 'INARI Personal Finance Coach' };
  };

  const { title, desc } = getPageTitle();

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#0f172a] flex">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-white border-r border-[#e5e7eb] shadow-sm flex flex-col justify-between z-50 transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6">
          {/* Logo & Brand Mark */}
          <div className="flex items-center justify-between pb-6 border-b border-[#e5e7eb]">
            <div>
              <Link to="/dashboard" className="flex items-center gap-2 group">
                <span className="font-archivo font-black text-2xl tracking-tighter text-[#0f172a] group-hover:text-[#ff3b12] transition-colors">
                  INARI
                </span>
                <span className="w-2 h-2 rounded-full bg-[#ff3b12] animate-pulse" />
              </Link>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#64748b] mt-0.5">
                Living Money Model
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-[#64748b] hover:text-[#0f172a]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Profile Version Badge */}
          <div className="mt-4 p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#64748b]">
                Active Profile
              </div>
              <div className="font-mono text-xs font-bold text-[#0f172a] flex items-center gap-1.5 mt-0.5">
                <span className="text-[#ff3b12]">v{overview?.profile_version || 1}</span>
                <span className="text-[10px] text-[#64748b]">({overview?.profile_source || 'derived'})</span>
              </div>
            </div>
            <button
              onClick={handleRederive}
              disabled={rederiving}
              title="Re-derive profile deterministically from transactions"
              className="p-1.5 rounded bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rederiving ? 'animate-spin text-[#ff3b12]' : ''}`} />
            </button>
          </div>

          {/* Nav List */}
          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg font-mono text-xs tracking-wider transition-all ${
                    active
                      ? 'bg-[#ff3b12] text-white font-bold shadow-sm shadow-[#ff3b12]/20'
                      : 'text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        active ? 'bg-white text-[#ff3b12]' : 'bg-[#ff3b12] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-[#e5e7eb] space-y-3">
          <Link
            to="/dashboard/transactions"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f1f5f9] text-xs font-mono text-[#0f172a] font-medium transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#ff3b12]" />
            <span>Drop Statement</span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 font-mono text-xs text-[#64748b] hover:text-[#0f172a] transition-colors pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit to Landing</span>
          </Link>

          <div className="pt-2 border-t border-[#e5e7eb] flex items-center gap-2 text-[10px] text-[#64748b] font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
            <span>Educational · Non-advisory</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-[#e5e7eb] shadow-sm px-6 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-[#64748b] hover:text-[#0f172a]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-archivo font-extrabold text-lg text-[#0f172a] uppercase tracking-tight">
                {title}
              </h1>
              <p className="font-mono text-[11px] text-[#64748b] hidden sm:block">
                {desc}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs">
            {overview && (
              <>
                <div className="hidden lg:flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1.5 rounded-md">
                  <span className="text-[#64748b] text-[10px] uppercase">Net Flow:</span>
                  <span
                    className={`font-bold ${
                      overview.net_cash_flow >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'
                    }`}
                  >
                    {overview.net_cash_flow >= 0 ? '+' : ''}₹{overview.net_cash_flow.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-2 bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1.5 rounded-md">
                  <span className="text-[#64748b] text-[10px] uppercase">Runway:</span>
                  <span className="font-bold text-[#0f172a]">
                    {overview.emergency_runway_months.toFixed(1)} mo
                  </span>
                </div>
              </>
            )}

            <Link
              to="/dashboard/planner"
              className="bg-[#ff3b12] hover:bg-[#e0340f] text-white font-mono text-xs px-3.5 py-1.5 rounded font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-[#ff3b12]/20"
            >
              <span>Simulate</span>
              <span className="text-xs">⚡</span>
            </Link>
          </div>
        </header>

        {/* Nested Page Outlet */}
        <main className="flex-1 p-6 lg:p-10 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
