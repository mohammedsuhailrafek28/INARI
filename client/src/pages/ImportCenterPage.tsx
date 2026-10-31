import { AppFrame } from "@/components/inari/AppFrame";
import { ImportCenter } from "@/components/inari/ImportCenter";
import { CoveragePanel } from "@/components/inari/panels";
import { DemoNotice, ModeBanner } from "@/components/inari/kit";
import { trpc } from "@/lib/trpc";
import { formatCurrencyINR } from "@/lib/formatters";

function ResultingLedger() {
  const snap = trpc.inari.getSnapshot.useQuery();
  const s = snap.data;
  if (!s || s.coverage.transactionCount === 0) return null;
  return (
    <section className="rounded-wv-card border border-wv-border bg-wv-surface p-5 shadow-wv-card" aria-label="Resulting ledger">
      <h2 className="font-display text-lg font-bold">What your ledger shows now</h2>
      <div data-testid="ledger-summary" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Transactions", String(s.coverage.transactionCount)], ["Monthly income", s.monthlyIncome === null ? "Not provided" : formatCurrencyINR(s.monthlyIncome)], ["Monthly expenses", s.monthlyExpenses === null ? "Not provided" : formatCurrencyINR(s.monthlyExpenses)], ["Monthly surplus", s.monthlySurplus === null ? "Not provided" : formatCurrencyINR(s.monthlySurplus)], ["Savings rate", s.savingsRate === null ? "Not provided" : `${s.savingsRate.toFixed(2)}%`]].map(([l, v]) => (
          <div key={l} className="rounded-md border border-wv-border p-3"><div className="text-xs text-wv-text-secondary">{l}</div><div className="font-semibold">{v}</div></div>
        ))}
      </div>
      <p className="mt-2 text-xs text-wv-text-secondary">{s.coverage.firstDate} to {s.coverage.lastDate}. Figures use the average of your latest complete months. Balances you have not entered stay “Not provided”.</p>
    </section>
  );
}

export default function ImportCenterPage() {
  return (
    <AppFrame active="/import" title="Import Center" description="Bring in a statement and every page in INARI updates from the same ledger: dashboard, spending, goals, recommendations and the advisor.">
      <ModeBanner />
      <DemoNotice />
      <ImportCenter />
      <ResultingLedger />
      <CoveragePanel />
    </AppFrame>
  );
}
