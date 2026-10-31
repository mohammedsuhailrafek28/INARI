import React, { useState } from 'react';
import { Sliders, AlertTriangle, ArrowRight, TrendingUp, ShieldCheck, Check, Sparkles, PieChart, Calendar } from 'lucide-react';
import { Section } from './ui/Section';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  MOCK_PROFILE,
  MOCK_GOALS,
  MOCK_SUBSCRIPTION_ALERTS,
  MOCK_SPEND_CATEGORIES,
} from '../data/mock';

export const ProductPreview: React.FC = () => {
  // What-if simulation state
  const [diningCutPct, setDiningCutPct] = useState(30);
  const [rentHikePct, setRentHikePct] = useState(0);
  const [gymCanceled, setGymCanceled] = useState(false);

  // Computed values from simulation
  const baselineDining = 14200;
  const simulatedDining = Math.round(baselineDining * (1 - diningCutPct / 100));
  const diningSavings = baselineDining - simulatedDining;

  const baselineRent = 22000;
  const simulatedRent = Math.round(baselineRent * (1 + rentHikePct / 100));
  const rentIncrease = simulatedRent - baselineRent;

  const gymSavings = gymCanceled ? 2499 : 0;

  // Total net monthly change
  const netMonthlyChange = diningSavings - rentIncrease + gymSavings;

  const baselineNetSavings = MOCK_PROFILE.monthlyIncome - MOCK_PROFILE.fixedCostsTotal - MOCK_PROFILE.variableSpendAvg;
  const simulatedNetSavings = baselineNetSavings + netMonthlyChange;

  const simulatedFixedCosts = MOCK_PROFILE.fixedCostsTotal + rentIncrease - gymSavings;
  const simulatedRunway = (MOCK_PROFILE.emergencyFundBalance / simulatedFixedCosts).toFixed(1);

  return (
    <Section id="preview" canvas="dark" className="border-t border-border-dark">
      {/* Section Eyebrow */}
      <div className="flex items-center gap-3 font-mono text-xs md:text-sm tracking-wideMono uppercase text-ink-mutedLight mb-6">
        <span className="w-2.5 h-2.5 bg-thread" />
        <span>03 // INTERACTIVE CONSOLE PREVIEW</span>
      </div>

      {/* Mammoth Headline */}
      <div className="max-w-4xl mb-12 md:mb-16">
        <h2 className="font-archivo font-[800] text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.9] tracking-tightest uppercase text-ink-light">
          THE LIVING MONEY <br />
          MODEL IN ACTION.
        </h2>
        <p className="mt-6 font-sans text-lg sm:text-xl text-ink-mutedLight max-w-2xl leading-relaxed">
          Interact directly with the simulation engine below. Adjust the lifestyle dials to observe real-time cash flow recalculation and goal delivery acceleration.
        </p>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Cash Flow & Spending Chart (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          {/* Card 1: Cash Flow & Category Distribution */}
          <Card theme="dark" padding="md" className="border-border-dark">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-border-dark">
              <div className="flex items-center gap-3">
                <PieChart className="w-5 h-5 text-thread" />
                <h3 className="font-archivo font-bold text-lg text-ink-light uppercase tracking-tight">
                  Monthly Cash Flow Breakdown
                </h3>
              </div>
              <Badge variant="emerald" dot>
                STABLE INFLOW: ₹{MOCK_PROFILE.monthlyIncome.toLocaleString()}
              </Badge>
            </div>

            {/* Inflow vs Outflow Visual Bar */}
            <div className="space-y-4">
              <div className="flex justify-between font-mono text-xs text-ink-mutedLight uppercase">
                <span>Total Monthly Inflow</span>
                <span className="text-white font-bold">₹{MOCK_PROFILE.monthlyIncome.toLocaleString()}</span>
              </div>
              <div className="h-6 w-full bg-white/5 flex overflow-hidden border border-border-dark">
                <div
                  className="bg-zinc-600 transition-all duration-300 flex items-center justify-center text-[10px] font-mono text-white/80"
                  style={{ width: `${(simulatedFixedCosts / MOCK_PROFILE.monthlyIncome) * 100}%` }}
                  title="Fixed Costs"
                >
                  FIXED ₹{simulatedFixedCosts.toLocaleString()}
                </div>
                <div
                  className="bg-thread transition-all duration-300 flex items-center justify-center text-[10px] font-mono text-white"
                  style={{ width: `${((MOCK_PROFILE.variableSpendAvg - diningSavings) / MOCK_PROFILE.monthlyIncome) * 100}%` }}
                  title="Variable Spend"
                >
                  VARIABLE
                </div>
                <div
                  className="bg-emerald transition-all duration-300 flex items-center justify-center text-[10px] font-mono text-white font-bold"
                  style={{ width: `${(simulatedNetSavings / MOCK_PROFILE.monthlyIncome) * 100}%` }}
                  title="Net Savings"
                >
                  +₹{simulatedNetSavings.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Dynamic Spending Breakdown Bars */}
            <div className="mt-8 space-y-4 pt-6 border-t border-border-dark">
              <div className="font-mono text-xs uppercase tracking-wider text-ink-mutedLight mb-2">
                Variable Spend Categories (Adjustable via Scenarios)
              </div>
              {MOCK_SPEND_CATEGORIES.map((cat) => {
                const isDining = cat.name.includes('Dining');
                const currentAmt = isDining ? simulatedDining : cat.amount;
                return (
                  <div key={cat.name} className="flex flex-col gap-1.5">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className={isDining && diningCutPct > 0 ? 'text-thread font-bold' : 'text-ink-light'}>
                          {cat.name} {isDining && diningCutPct > 0 && `(-${diningCutPct}%)`}
                        </span>
                      </span>
                      <span className="font-semibold text-ink-light">₹{currentAmt.toLocaleString()}/mo</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-none overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          backgroundColor: cat.color,
                          width: `${(currentAmt / 15000) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Runway Meter Summary */}
            <div className="mt-8 p-4 bg-white/5 border border-border-dark flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-ink-light">
                <ShieldCheck className="w-4 h-4 text-emerald" />
                <span>LIQUID EMERGENCY RUNWAY:</span>
              </div>
              <div className="text-sm font-bold text-emerald">
                {simulatedRunway} MONTHS COVERAGE
              </div>
            </div>
          </Card>

          {/* Card 2: Interactive Goal Progress */}
          <Card theme="dark" padding="md" className="border-border-dark">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-border-dark">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-thread" />
                <h3 className="font-archivo font-bold text-lg text-ink-light uppercase tracking-tight">
                  Goal Arrival Projections
                </h3>
              </div>
              <span className="font-mono text-xs text-ink-mutedLight uppercase">
                24-MO HORIZON
              </span>
            </div>

            <div className="space-y-6">
              {MOCK_GOALS.map((goal) => {
                const isMacBook = goal.id === 'goal-3';
                // If user cut dining by >= 25% or canceled gym, macbook accelerates
                const isAccelerated = isMacBook && (diningCutPct >= 25 || gymCanceled);
                const statusLabel = isAccelerated ? 'ON TRACK (EXPEDITED)' : goal.status === 'at_risk' ? 'AT RISK (+2 MO)' : 'ON TRACK';
                const statusColor = isAccelerated ? 'emerald' : goal.status === 'at_risk' ? 'vermilion' : 'emerald';
                const projectedMonth = isAccelerated ? 'Mar 2027 (3 Mo Early!)' : goal.projectedMonth;

                const progressPct = Math.round((goal.currentAmount / goal.targetAmount) * 100);

                return (
                  <div key={goal.id} className="p-4 bg-canvas-dark border border-border-dark flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-archivo font-bold text-base text-ink-light uppercase">
                        {goal.name}
                      </span>
                      <Badge variant={statusColor} dot>
                        {statusLabel}
                      </Badge>
                    </div>

                    <div className="flex justify-between font-mono text-xs text-ink-mutedLight">
                      <span>Funded: ₹{goal.currentAmount.toLocaleString()} / ₹{goal.targetAmount.toLocaleString()}</span>
                      <span className="font-bold text-ink-light">{progressPct}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          statusColor === 'emerald' ? 'bg-emerald' : 'bg-thread'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between font-mono text-[11px] text-ink-mutedLight pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-thread" />
                        Target: {goal.targetDate}
                      </span>
                      <span className={isAccelerated ? 'text-emerald font-bold' : ''}>
                        Arrival: {projectedMonth}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: What-If Simulator + Subscription Sentinel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {/* Card 3: Interactive What-If Simulator */}
          <Card theme="dark" padding="md" className="border-thread/50 bg-[#0d0d0f] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
              <Sliders className="w-24 h-24 text-thread" />
            </div>

            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border-dark">
              <Sliders className="w-5 h-5 text-thread" />
              <div>
                <h3 className="font-archivo font-bold text-lg text-ink-light uppercase tracking-tight">
                  What-If Simulation Engine
                </h3>
                <span className="font-mono text-xs text-ink-mutedLight uppercase">
                  Composable Non-Destructive Modeling
                </span>
              </div>
            </div>

            {/* Slider 1: Dining Out Cut */}
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center font-mono text-xs">
                <span className="text-ink-light uppercase">Cut Dining Out Spend:</span>
                <span className="text-thread font-bold text-sm">-{diningCutPct}% (₹{diningSavings.toLocaleString()}/mo)</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={diningCutPct}
                onChange={(e) => setDiningCutPct(Number(e.target.value))}
                className="w-full"
                aria-label="Adjust Dining Out Reduction Percentage"
              />
              <div className="flex justify-between text-[10px] font-mono text-ink-mutedLight">
                <span>0% (₹14,200)</span>
                <span>25%</span>
                <span>50% (₹7,100)</span>
              </div>
            </div>

            {/* Slider 2: Rent Hike Stress-Test */}
            <div className="space-y-4 mb-6 pt-4 border-t border-border-dark">
              <div className="flex justify-between items-center font-mono text-xs">
                <span className="text-ink-light uppercase">Rent Escalation Shock:</span>
                <span className="text-gold-light font-bold text-sm">+{rentHikePct}% (+₹{rentIncrease.toLocaleString()}/mo)</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="5"
                value={rentHikePct}
                onChange={(e) => setRentHikePct(Number(e.target.value))}
                className="w-full"
                aria-label="Adjust Rent Increase Percentage"
              />
              <div className="flex justify-between text-[10px] font-mono text-ink-mutedLight">
                <span>0% (₹22,000)</span>
                <span>+10% (+₹2.2k)</span>
                <span>+25% (+₹5.5k)</span>
              </div>
            </div>

            {/* Simulation Impact Readout */}
            <div className="p-4 bg-white/5 border border-border-dark space-y-2 mb-6">
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-mutedLight flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-thread" />
                <span>Simulated Life Outcome</span>
              </div>
              <p className="font-sans text-sm text-ink-light leading-relaxed">
                {netMonthlyChange >= 0 ? (
                  <>
                    Applying this scenario liberates <span className="text-emerald font-bold">+₹{netMonthlyChange.toLocaleString()}/mo</span> in net savings, safely advancing your MacBook Studio Rig goal by <span className="text-emerald font-bold">3.5 months</span>!
                  </>
                ) : (
                  <>
                    The rent hike consumes <span className="text-thread font-bold">-₹{Math.abs(netMonthlyChange).toLocaleString()}/mo</span>, tightening monthly cash buffer. Consider dampening dining to offset.
                  </>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="w-1/2 text-[11px]"
                onClick={() => {
                  setDiningCutPct(0);
                  setRentHikePct(0);
                  setGymCanceled(false);
                }}
              >
                Reset Dials
              </Button>
              <Button
                variant="vermilion"
                size="sm"
                className="w-1/2 text-[11px]"
                onClick={() => {
                  setDiningCutPct(30);
                  setRentHikePct(10);
                }}
              >
                Preset: Cut 30%
              </Button>
            </div>
          </Card>

          {/* Card 4: Subscription Sentinel Alert */}
          <Card theme="dark" padding="md" className="border-border-dark">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-dark">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-thread" />
                <h3 className="font-archivo font-bold text-base text-ink-light uppercase tracking-tight">
                  Subscription Sentinel
                </h3>
              </div>
              <Badge variant={gymCanceled ? 'emerald' : 'vermilion'}>
                {gymCanceled ? 'RESOLVED' : '1 UNUSED SERVICE'}
              </Badge>
            </div>

            {MOCK_SUBSCRIPTION_ALERTS.slice(0, 1).map((sub) => (
              <div key={sub.id} className="p-4 bg-canvas-dark border border-border-dark space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-archivo font-bold text-sm text-ink-light uppercase">
                      {sub.name}
                    </h4>
                    <span className="font-mono text-xs text-thread font-semibold">
                      ₹{sub.amount.toLocaleString()} / {sub.billingCycle}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-ink-mutedLight uppercase border border-white/10 px-2 py-0.5">
                    {sub.lastUsedDays}d DORMANT
                  </span>
                </div>

                <p className="font-sans text-xs text-ink-mutedLight leading-relaxed">
                  {sub.reason}
                </p>

                <div className="pt-2">
                  {gymCanceled ? (
                    <div className="flex items-center gap-2 font-mono text-xs text-emerald font-semibold">
                      <Check className="w-4 h-4" />
                      <span>Canceled — Saving ₹29,988/yr</span>
                    </div>
                  ) : (
                    <Button
                      variant="dark"
                      size="sm"
                      className="w-full text-xs text-thread border-thread/40 hover:bg-thread hover:text-white"
                      onClick={() => setGymCanceled(true)}
                    >
                      Audit & Cancel (+₹2,499/mo)
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Full Dashboard Launcher Banner */}
      <div className="mt-12 p-6 rounded-xl bg-canvas-card border border-border-dark flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-archivo font-bold text-lg text-ink-light uppercase">
            Experience the Full Integrated INARI Engine
          </h4>
          <p className="font-mono text-xs text-ink-mutedLight mt-0.5">
            Real SQLite profile persistence, statement PDF/CSV parser, category correction loop, and multi-year simulation.
          </p>
        </div>
        <a
          href="/dashboard"
          className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-lg bg-thread hover:bg-[#e0340f] text-white font-mono text-xs font-bold transition-all"
        >
          <span>Launch Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </Section>
  );
};

