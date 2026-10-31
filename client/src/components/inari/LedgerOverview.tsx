import { trpc } from "@/lib/trpc";
import { formatCurrencyINR, formatTitle } from "@/lib/formatters";
import { Panel, Err, errMsg, Muted } from "./kit";

/** Displays backend amounts. Ratios below only scale the drawn bars; no financial totals are recomputed here. */
export function LedgerPulse({
  income,
  expenses,
  surplus,
  savingsRate,
}: {
  income: number | null;
  expenses: number | null;
  surplus: number | null;
  savingsRate: number | null;
}) {
  return (
    <section
      className="ledger-pulse"
      aria-label="Monthly ledger overview"
      data-testid="ledger-pulse"
    >
      {[
        [
          "Monthly income",
          income === null ? "Not provided" : formatCurrencyINR(income),
        ],
        [
          "Monthly expenses",
          expenses === null ? "Not provided" : formatCurrencyINR(expenses),
        ],
        [
          "Monthly surplus",
          surplus === null ? "Not provided" : formatCurrencyINR(surplus),
        ],
        [
          "Savings rate",
          savingsRate === null ? "Not provided" : `${savingsRate.toFixed(2)}%`,
        ],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>
            {label === "Savings rate"
              ? "Share of monthly income saved"
              : "Latest complete months · INR"}
          </small>
        </div>
      ))}
    </section>
  );
}
export function LedgerCategories() {
  const query = trpc.spending.getBreakdown.useQuery();
  const rows = Object.entries(query.data ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <Panel
      title="Where your money goes"
      description="Monthly category averages from the same imported ledger. Amounts in INR."
    >
      {query.isLoading && <Muted>Loading category amounts…</Muted>}
      <Err msg={query.error ? errMsg(query.error) : null} />
      {!query.isLoading && rows.length === 0 && (
        <Muted>No category amounts yet. Import a complete month first.</Muted>
      )}
      <div className="ledger-categories" data-testid="dashboard-categories">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div>
              <span>{formatTitle(label)}</span>
              <strong>{formatCurrencyINR(value)}</strong>
            </div>
            <div
              role="img"
              aria-label={`${formatTitle(label)}: ${formatCurrencyINR(value)} monthly average`}
              className="category-track"
            >
              <span style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <a className="text-link" href="/spending">
        Review categories and transactions →
      </a>
    </Panel>
  );
}
export function PageSections({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  return (
    <nav className="page-sections" aria-label="Page sections">
      {items.map(i => (
        <a key={i.href} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
