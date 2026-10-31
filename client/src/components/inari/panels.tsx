import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { InariAdvisorResponse } from "@shared/inari/contracts";
import { Err, Muted, Note, Panel, btnCls, btnGhostCls, errMsg, fieldCls, inr, inrPaise } from "./kit";

/* ---------------------------------------------------------------- advisor action card */
export function ActionCard({ a, onDone }: { a: NonNullable<InariAdvisorResponse["proposedActions"]>[number]; onDone?: () => void }) {
  const utils = trpc.useUtils();
  const missing = a.missingFields ?? [];
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(missing.map(f => [f, f === "idempotencyKey" ? `ui-${crypto.randomUUID()}` : ""])));
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const complete = a.inputComplete !== false || missing.every(f => vals[f]?.trim());
  const run = async () => {
    setState("busy");
    try {
      const name = a.procedure.replace(/^inari\./, "");
      const input: Record<string, unknown> = { ...a.input };
      for (const f of missing) { const v = vals[f]; input[f] = f === "idempotencyKey" || f === "transactionId" ? v : Number.isNaN(Number(v)) ? v : Number(v); }
      const proc = (utils.client.inari as unknown as Record<string, { mutate: (i: unknown) => Promise<unknown> }>)[name];
      if (!proc) throw new Error(`Unknown action ${a.procedure}`);
      await proc.mutate(input);
      setState("done"); setMsg("Done. Your ledger and every page now reflect this."); utils.invalidate(); onDone?.();
    } catch (e) { setState("error"); setMsg(errMsg(e)); }
  };
  return (
    <div className="space-y-2 rounded-md border border-dashed border-wv-primary/50 p-3" data-testid="action-card">
      <div className="font-medium">{a.title}</div>
      <div className="text-sm text-wv-text-secondary">{a.description} Nothing happens until you confirm.</div>
      {missing.filter(f => f !== "idempotencyKey").map(f => (
        <label key={f} className="block text-sm">{f}
          <input className={`${fieldCls} mt-1 w-full`} value={vals[f] ?? ""} onChange={e => setVals(v => ({ ...v, [f]: e.target.value }))} />
        </label>
      ))}
      <button type="button" className={btnCls} disabled={!complete || state === "busy" || state === "done"} onClick={run}>
        {state === "done" ? "Confirmed" : state === "busy" ? "Working…" : "Confirm"}
      </button>
      {msg && <p className={`text-sm ${state === "error" ? "text-wv-error" : "text-wv-success"}`}>{msg}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- what-if */
const WHATIF_CATEGORIES = ["dining", "shopping", "entertainment", "groceries", "transport", "subscription", "fuel", "travel"];
export function WhatIfPanel() {
  const sim = trpc.inari.simulate.useMutation();
  const goals = trpc.inari.getGoals.useQuery();
  const subsQ = trpc.inari.listSubscriptions.useQuery();
  const [kind, setKind] = useState<"income" | "category" | "oneoff" | "sip" | "debt" | "goal" | "cancel">("income");
  const [subId, setSubId] = useState("");
  const [amount, setAmount] = useState("-10000");
  const [category, setCategory] = useState("dining");
  const [goalId, setGoalId] = useState("");
  const run = () => {
    if (kind === "cancel") {
      if (subId) sim.mutate({ scenarios: [{ type: "cancel_subscriptions", subscriptionIds: [subId] }] });
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return;
    const a = Math.abs(n);
    const scenario =
      kind === "income" ? { type: "change_income" as const, deltaPerMonth: n }
      : kind === "category" ? { type: "reduce_category" as const, category: category as never, amountPerMonth: a }
      : kind === "oneoff" ? { type: "one_off_expense" as const, amount: a, inMonths: 0 }
      : kind === "sip" ? { type: "start_sip" as const, amountPerMonth: a }
      : kind === "debt" ? { type: "pay_down_debt" as const, amountPerMonth: a }
      : { type: "change_goal_contribution" as const, goalId, newMonthly: a };
    if (kind === "goal" && !goalId) return;
    sim.mutate({ scenarios: [scenario] });
  };
  const r = sim.data;
  return (
    <Panel id="whatif" title="What-if scenario" description="Test a change before making it. This never changes your ledger.">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Scenario
          <select className={`${fieldCls} block`} value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
            <option value="income">Change monthly income by</option>
            <option value="category">Reduce a category by</option>
            <option value="oneoff">One-off expense of</option>
            <option value="sip">Start a monthly SIP of</option>
            <option value="debt">Pay down card debt by (per month)</option>
            <option value="goal">Change a goal’s monthly saving to</option>
            <option value="cancel">Cancel a recurring payment (what-if only)</option>
          </select></label>
        {kind === "cancel" && (
          <label className="text-sm">Recurring payment
            <select className={`${fieldCls} block`} value={subId} onChange={e => setSubId(e.target.value)}>
              <option value="">Choose…</option>
              {(subsQ.data?.items ?? []).filter(x => x.status !== "dismissed").map(x => <option key={x.id} value={x.id}>{x.merchant}</option>)}
            </select></label>
        )}
        {kind === "category" && (
          <label className="text-sm">Category
            <select className={`${fieldCls} block`} value={category} onChange={e => setCategory(e.target.value)}>
              {WHATIF_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select></label>
        )}
        {kind === "goal" && (
          <label className="text-sm">Goal
            <select className={`${fieldCls} block`} value={goalId} onChange={e => setGoalId(e.target.value)}>
              <option value="">Choose…</option>
              {(goals.data?.items ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
        )}
        {kind !== "cancel" && <label className="text-sm">₹ {kind === "oneoff" ? "amount" : "per month"}
          <input className={`${fieldCls} block w-32`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Scenario amount in rupees" /></label>}
        <button type="button" className={btnCls} onClick={run} disabled={sim.isPending}>{sim.isPending ? "Running…" : "Run scenario"}</button>
      </div>
      <Err msg={sim.error ? errMsg(sim.error) : null} />
      {r && (r.status === "insufficient_data" ? <Muted>Not enough data to simulate. Import a statement covering a full month first.</Muted> : (
        <table className="w-full text-sm" data-testid="whatif-result">
          <thead><tr className="text-left text-wv-text-secondary"><th>Metric</th><th>Now</th><th>Scenario</th></tr></thead>
          <tbody>{r.metrics.map(m => (
            <tr key={m.label} className="border-t border-wv-border"><td className="py-1">{m.label}</td>
              <td>{m.unit === "inr" ? inr(m.baseline) : m.baseline ?? "—"}{m.unit === "percent" ? "%" : ""}</td>
              <td>{m.unit === "inr" ? inr(m.scenario) : m.scenario ?? "—"}{m.unit === "percent" ? "%" : ""}</td></tr>
          ))}</tbody>
        </table>
      ))}
      {r?.warnings.map((w, i) => <Note key={i} tone="warn">{w}</Note>)}
      {r && r.assumptions.length > 0 && <Muted>Assumptions: {r.assumptions.join(" ")}</Muted>}
      {r && <Muted>{r.disclaimer} Your ledger was not changed.</Muted>}
    </Panel>
  );
}

/* ---------------------------------------------------------------- monthly report */
export function ReportPanel() {
  const months = trpc.inari.listReportMonths.useQuery();
  const [picked, setPicked] = useState<string | null>(null);
  const list = months.data?.months ?? [];
  const month = picked ?? [...list].sort().at(-1) ?? null; // default: the latest month
  const rep = trpc.inari.monthlyReport.useQuery({ month: month ?? "2000-01" }, { enabled: !!month });
  const r = rep.data;
  return (
    <Panel id="report" title="Monthly report" description="A month in review, calculated from your ledger.">
      {list.length === 0 && <Muted>No months available yet. Import a statement first.</Muted>}
      {list.length > 0 && (
        <label className="text-sm">Month <select className={fieldCls} value={month ?? ""} onChange={e => setPicked(e.target.value)} aria-label="Report month">
          {[...list].sort().reverse().map(m => <option key={m}>{m}</option>)}</select></label>
      )}
      <Err msg={rep.error ? errMsg(rep.error) : null} />
      {r && r.status === "ok" && (
        <div className="space-y-2" data-testid="report">
          <p className="font-medium">{r.narrative.headline}</p>
          <p className="text-sm">{r.narrative.body}</p>
          <p className="text-sm">Income {inr(r.totals.income)} · Expenses {inr(r.totals.expenses)} · Savings rate {r.totals.savingsRate.toFixed(2)}%</p>
          <ul className="list-disc pl-5 text-sm">{r.categories.slice(0, 6).map(c => <li key={c.category}>{c.category}: {inr(c.amount)} ({c.sharePercent.toFixed(1)}%)</li>)}</ul>
          {r.actions.map(a => <p key={a.title} className="text-sm"><b>{a.title}</b>: {a.reason}</p>)}
          {r.period?.partial && <Note tone="warn">Partial month: {r.period.reason}</Note>}
          {(r.unknowns ?? []).map((u, i) => <Muted key={i}>Not provided: {u.replace(/([A-Z])/g, " $1").toLowerCase()}</Muted>)}
        </div>
      )}
      {r && r.status !== "ok" && <Muted>Not enough data for this month.</Muted>}
    </Panel>
  );
}

/* ---------------------------------------------------------------- EMI reality check */
export function EmiPanel() {
  const emi = trpc.inari.emiCheck.useMutation();
  const [f, setF] = useState({ cashPrice: "40000", emiMonthly: "6700", months: "6", processingFee: "500" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(v => ({ ...v, [k]: e.target.value }));
  const run = () => emi.mutate({
    cashPrice: Number(f.cashPrice), emiMonthly: Number(f.emiMonthly), months: Number(f.months),
    ...(f.processingFee.trim() ? { processingFee: Number(f.processingFee) } : {}),
  });
  const r = emi.data;
  return (
    <Panel id="emi" title="Is this “no-cost EMI” really free?" description="Compare paying upfront with an EMI plan. Calculation only: no debt or transaction is created.">
      <div className="flex flex-wrap items-end gap-2">
        {([["cashPrice", "Cash price ₹"], ["emiMonthly", "Monthly instalment ₹"], ["months", "Months"], ["processingFee", "Processing fee ₹ (optional)"]] as const).map(([k, l]) => (
          <label key={k} className="text-sm">{l}<input className={`${fieldCls} block w-36`} inputMode="decimal" value={f[k]} onChange={set(k)} /></label>
        ))}
        <button type="button" className={btnCls} onClick={run} disabled={emi.isPending}>{emi.isPending ? "Checking…" : "Check"}</button>
      </div>
      <Err msg={emi.error ? errMsg(emi.error) : null} />
      {r && (
        <div className="space-y-1 text-sm" data-testid="emi-result">
          <p className="font-medium">{r.verdict}</p>
          <p>Upfront {inrPaise(r.totalPayableUpfrontPaise)} vs EMI total {inrPaise(r.totalPayableEmiPaise)} (extra {inrPaise(r.extraCostOfEmiPaise)}). Monthly commitment {inrPaise(r.monthlyCommitmentPaise)}.</p>
          {r.surplusAfterEmiPaise !== null && <p>Your monthly surplus would go from {inrPaise(r.monthlySurplusPaise)} to {inrPaise(r.surplusAfterEmiPaise)} while the EMI runs.</p>}
          {r.missingTerms.length > 0 && <Note tone="warn">Not provided (counted as zero): {r.missingTerms.join("; ")}.</Note>}
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- data coverage + quality */
export function CoveragePanel() {
  const cov = trpc.inari.dataCoverage.useQuery();
  const snap = trpc.inari.getSnapshot.useQuery();
  const d = cov.data;
  const notes = snap.data?.dataQuality ?? [];
  return (
    <Panel id="coverage" title="Data coverage and quality" description="What INARI has actually observed, and where the numbers are uncertain.">
      <Err msg={cov.error ? errMsg(cov.error) : null} />
      {d && (
        <div className="space-y-2 text-sm" data-testid="coverage">
          <p>{d.observed.transactionCount} transactions{d.observed.from ? `, ${d.observed.from} to ${d.observed.to}` : ""}. Sources: {Object.entries(d.observed.bySource).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}.</p>
          {d.gaps.map((g, i) => <Note key={i} tone="warn">{g.detail}</Note>)}
          <Muted>{d.note}</Muted>
        </div>
      )}
      {notes.map((n, i) => <Note key={i} tone={n.severity === "warning" ? "warn" : "info"}>{n.message}</Note>)}
      {snap.data && snap.data.missing.length > 0 && <Muted>Not provided (never guessed): {snap.data.missing.map(m => m.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}.</Muted>}
    </Panel>
  );
}

/* ---------------------------------------------------------------- spending trend (CSS bars from the ledger) */
export function TrendPanel() {
  const months = trpc.inari.listReportMonths.useQuery();
  const list = [...(months.data?.months ?? [])].sort().slice(-6);
  const reports = trpc.useQueries(t => list.map(m => t.inari.monthlyReport({ month: m })));
  const rows = list.map((m, i) => ({ month: m, r: reports[i]?.data })).filter(x => x.r && x.r.status === "ok");
  const max = Math.max(1, ...rows.flatMap(x => [x.r!.totals.income, x.r!.totals.expenses]));
  return (
    <Panel id="trend" title="Income and spending trend" description="Month by month, from your ledger.">
      {months.isLoading && <Muted>Loading…</Muted>}
      {rows.length === 0 && !months.isLoading && <Muted>No complete months yet. Import a statement first.</Muted>}
      <div className="space-y-2" data-testid="trend">
        {rows.map(({ month, r }) => (
          <div key={month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-wv-text-secondary">{month}</span>
            <div className="space-y-1" role="img" aria-label={`${month}: income ${inr(r!.totals.income)}, expenses ${inr(r!.totals.expenses)}`}>
              <div className="h-2 rounded bg-wv-primary" style={{ width: `${(r!.totals.income / max) * 100}%` }} />
              <div className="h-2 rounded bg-wv-accent" style={{ width: `${(r!.totals.expenses / max) * 100}%` }} />
            </div>
            <span>{inr(r!.totals.income - r!.totals.expenses)} saved</span>
          </div>
        ))}
        {rows.length > 0 && <p className="text-xs text-wv-text-secondary"><span className="mr-1 inline-block size-2 rounded bg-wv-primary" /> income <span className="mx-1 ml-3 inline-block size-2 rounded bg-wv-accent" /> expenses</p>}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- transaction review, corrections, reconciliation */
export function TransactionReview() {
  const utils = trpc.useUtils();
  const cats = trpc.inari.getCategories.useQuery();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const input = { limit: 60, ...(q.trim() ? { q: q.trim() } : {}), ...(category ? { category: category as never } : {}), ...(month ? { month } : {}), ...(needsReview ? { needsReview: true } : {}) };
  const list = trpc.inari.listTransactions.useQuery(input);
  const months = trpc.inari.listReportMonths.useQuery();
  const correct = trpc.inari.correctCategory.useMutation();
  const reconcile = trpc.inari.reconcile.useMutation();
  const rules = trpc.inari.listLearnedRules.useQuery();
  const delRule = trpc.inari.deleteLearnedRule.useMutation();
  const [applyMerchant, setApplyMerchant] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => utils.invalidate();
  const items = list.data?.items ?? [];

  return (
    <Panel id="transactions" title="Transactions and review" description="Every imported transaction. Fix a category and INARI learns the merchant; flagged rows can be reconciled. Totals, charts, goals and the advisor update immediately.">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Search<input className={`${fieldCls} block`} value={q} onChange={e => setQ(e.target.value)} placeholder="merchant or text" aria-label="Search transactions" /></label>
        <label className="text-sm">Category
          <select className={`${fieldCls} block`} value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All</option>{(cats.data?.items ?? []).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select></label>
        <label className="text-sm">Month
          <select className={`${fieldCls} block`} value={month} onChange={e => setMonth(e.target.value)} aria-label="Filter by month">
            <option value="">All</option>{[...(months.data?.months ?? [])].sort().reverse().map(m => <option key={m}>{m}</option>)}
          </select></label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={needsReview} onChange={e => setNeedsReview(e.target.checked)} /> Needs review only</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={applyMerchant} onChange={e => setApplyMerchant(e.target.checked)} /> Apply category fixes to this merchant</label>
      </div>
      <Err msg={list.error ? errMsg(list.error) : correct.error ? errMsg(correct.error) : reconcile.error ? errMsg(reconcile.error) : null} />
      {msg && <p role="status" className="text-sm text-wv-success" data-testid="review-msg">{msg}</p>}
      {list.isLoading && <Muted>Loading transactions…</Muted>}
      {!list.isLoading && items.length === 0 && <Muted>No transactions match. {needsReview ? "Nothing needs review." : "Import a statement or change the filters."}</Muted>}
      <div className="max-h-[28rem] overflow-auto rounded-md border border-wv-border">
        <table className="w-full text-sm" data-testid="transactions-table">
          <thead className="sticky top-0 bg-wv-surface text-left text-wv-text-secondary"><tr><th className="p-2">Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th><th className="p-2">Review</th></tr></thead>
          <tbody>
            {items.map(t => {
              const excluded = t.reconciliation && t.reconciliation.decision !== "kept_separate";
              const flagged = !!t.possibleDuplicateOf || t.reconciliation !== undefined;
              return (
                <tr key={t.id} className={`border-t border-wv-border align-top ${excluded ? "opacity-50" : ""}`}>
                  <td className="p-2 whitespace-nowrap">{t.postedOn}</td>
                  <td className="max-w-[16rem] break-words">{t.merchant ?? t.narration}<div className="text-xs text-wv-text-secondary">{t.source}{t.categorySource === "user" ? " · category set by you" : t.categorySource === "learned" ? " · category learned from your correction" : t.categorySource === "unclassified" ? " · needs a category" : ""}</div></td>
                  <td>
                    <select aria-label={`Category for ${t.narration}`} className={fieldCls} value={t.category} disabled={correct.isPending}
                      onChange={e => correct.mutate({ transactionId: t.id, category: e.target.value as never, applyToMerchant: applyMerchant }, { onSuccess: r => { setMsg(`Updated ${r.updated} transaction(s). All totals refreshed.`); refresh(); } })}>
                      {(cats.data?.items ?? [{ id: t.category, label: t.category, kind: "expense" as const }]).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className={`text-right whitespace-nowrap ${t.direction === "credit" ? "text-wv-success" : ""}`}>{t.direction === "debit" ? "−" : "+"}{inr(t.amount)}</td>
                  <td className="p-2 text-xs">
                    {flagged && <div className="mb-1 text-amber-700">{t.reconciliation ? `Decision: ${t.reconciliation.decision.replace(/_/g, " ")}` : "Possible duplicate"}</div>}
                    {(flagged || t.isTransfer || t.category === "transfer") && (
                      <div className="flex flex-wrap gap-1">
                        {(["exclude_duplicate", "exclude_card_double_count", "keep_separate"] as const).map(d => (
                          <button key={d} type="button" className={btnGhostCls} disabled={reconcile.isPending}
                            onClick={() => reconcile.mutate({ transactionIds: [t.id], decision: d }, { onSuccess: () => { setMsg("Reconciliation saved. Totals refreshed."); refresh(); } })}>
                            {d === "exclude_duplicate" ? "Duplicate" : d === "exclude_card_double_count" ? "Card repayment" : "Keep"}
                          </button>
                        ))}
                        {t.reconciliation && <button type="button" className={btnGhostCls} onClick={() => reconcile.mutate({ transactionIds: [t.id], decision: "undo" }, { onSuccess: () => { setMsg("Decision undone."); refresh(); } })}>Undo</button>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.data?.nextCursor && <Muted>Showing the first {items.length}. Narrow the filters to see others.</Muted>}
      {(rules.data?.items.length ?? 0) > 0 && (
        <div className="space-y-1" data-testid="learned-rules">
          <h3 className="text-sm font-semibold">Learned merchant rules</h3>
          {rules.data!.items.map(r => (
            <div key={r.ruleId} className="flex items-center justify-between gap-2 text-sm">
              <span>{r.merchantKey} → {r.category} (applied {r.appliedCount}×)</span>
              <button type="button" className={btnGhostCls} disabled={delRule.isPending} onClick={() => delRule.mutate({ ruleId: r.ruleId }, { onSuccess: refresh })}>Forget</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- manual cash entry */
export function ManualEntryPanel() {
  const utils = trpc.useUtils();
  const preview = trpc.inari.manualEntryPreview.useMutation();
  const commit = trpc.inari.manualEntryCommit.useMutation();
  const undo = trpc.inari.importUndo.useMutation();
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [dir, setDir] = useState<"" | "debit" | "credit">("");
  const [done, setDone] = useState<{ batchId: string; text: string } | null>(null);
  const committing = useRef(false);
  const p = preview.data;
  const e = p?.entry;
  const ask = () => {
    setDone(null);
    preview.mutate({ ...(text.trim() ? { text: text.trim() } : {}), ...(amount.trim() && Number(amount) > 0 ? { amount: Number(amount) } : {}), ...(dir ? { direction: dir } : {}) });
  };
  return (
    <Panel id="manual" title="Add cash or untracked money" description="Statements miss cash and off-statement spending. Say or type it, review the preview, then confirm. Entries are marked as user-entered and can be undone.">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[16rem] flex-1 text-sm">What happened?
          <input className={`${fieldCls} block w-full`} value={text} maxLength={300} onChange={ev => setText(ev.target.value)} placeholder="I spent 350 cash on groceries yesterday" onKeyDown={ev => { if (ev.key === "Enter") ask(); }} /></label>
        <label className="text-sm">Amount ₹ (optional)<input className={`${fieldCls} block w-28`} inputMode="decimal" value={amount} onChange={ev => setAmount(ev.target.value)} /></label>
        <label className="text-sm">Type
          <select className={`${fieldCls} block`} value={dir} onChange={ev => setDir(ev.target.value as typeof dir)}><option value="">From text</option><option value="debit">Spent</option><option value="credit">Received</option></select></label>
        <button type="button" className={btnCls} disabled={preview.isPending || (!text.trim() && !amount.trim())} onClick={ask}>Preview</button>
      </div>
      <Err msg={preview.error ? errMsg(preview.error) : commit.error ? errMsg(commit.error) : null} />
      {p && e && (
        <div className="space-y-2 rounded-md border border-dashed border-wv-primary/50 p-3 text-sm" data-testid="manual-preview">
          {p.needsUserInput.length > 0 ? (
            <p>I still need {p.needsUserInput.map(f => (f === "amount" ? "the amount" : "whether this was money spent or received")).join(" and ")}.</p>
          ) : (
            <p>Record a {e.direction === "debit" ? "spend" : "receipt"} of <b>{inrPaise(e.amountPaise)}</b> ({e.paymentType}) under <b>{(e.category ?? "other").replace(/_/g, " ")}</b> dated {e.postedOn}. The ledger has not changed yet.</p>
          )}
          {p.assumptions.map((a, i) => <Note key={i} tone="warn">{a}</Note>)}
          {p.previewId && p.needsUserInput.length === 0 && (
            <button type="button" className={btnCls} disabled={commit.isPending}
              onClick={() => { if (committing.current) return; committing.current = true; commit.mutate({ previewId: p.previewId!, idempotencyKey: `ui-${p.previewId}`.slice(0, 64) }, { onSettled: () => { committing.current = false; }, onSuccess: r => { setDone({ batchId: r.batchId, text: "Entry added to your ledger." }); preview.reset(); setText(""); setAmount(""); utils.invalidate(); } }); }}>
              {commit.isPending ? "Adding…" : "Confirm and add"}
            </button>
          )}
        </div>
      )}
      {done && (
        <p role="status" data-testid="manual-done" className="text-sm text-wv-success">{done.text}{" "}
          <button type="button" className="underline" disabled={undo.isPending} onClick={() => undo.mutate({ batchId: done.batchId }, { onSuccess: () => { setDone({ batchId: done.batchId, text: "Entry removed." }); utils.invalidate(); } })}>Undo</button>
        </p>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- recurring payments */
export function SubscriptionsPanel() {
  const utils = trpc.useUtils();
  const subs = trpc.inari.listSubscriptions.useQuery();
  const decide = trpc.inari.confirmSubscription.useMutation({ onSuccess: () => utils.invalidate() });
  const d = subs.data;
  return (
    <Panel id="recurring" title="Recurring payments" description="Detected from repeated payments. Confirm or dismiss each one; cancelling is only ever a what-if.">
      {subs.isLoading && <Muted>Detecting…</Muted>}
      {d && d.items.length === 0 && <Muted>No recurring payments detected yet.</Muted>}
      {d && d.items.length > 0 && <p className="text-sm" data-testid="recurring-total">Active total: <b>{inr(d.monthlyTotal)}</b> a month ({inr(d.annualTotal)} a year).</p>}
      {d?.items.map(s => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-wv-border pt-2 text-sm">
          <span><b>{s.merchant}</b> · {inr(s.typicalAmount)} {s.cadence} · next {s.nextExpectedOn} · <span className="text-wv-text-secondary">{s.status}</span>
            {s.flags.map(f => <span key={f} className="ml-1 text-amber-700">[{f.replace(/_/g, " ")}]</span>)}
            {s.priceChange && <span className="ml-1 text-amber-700">price {inr(s.priceChange.from)} → {inr(s.priceChange.to)}</span>}</span>
          <span className="flex gap-1">
            {s.status !== "confirmed" && <button type="button" className={btnGhostCls} disabled={decide.isPending} onClick={() => decide.mutate({ subscriptionId: s.id, decision: "confirm" })}>Confirm</button>}
            {s.status !== "dismissed" && <button type="button" className={btnGhostCls} disabled={decide.isPending} onClick={() => decide.mutate({ subscriptionId: s.id, decision: "dismiss" })}>Not recurring</button>}
          </span>
        </div>
      ))}
      <Err msg={decide.error ? errMsg(decide.error) : null} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- refund watch + reimbursements */
export function ClaimsPanel() {
  const utils = trpc.useUtils();
  const claims = trpc.inari.listClaims.useQuery();
  const [txq, setTxq] = useState("");
  const txs = trpc.inari.listTransactions.useQuery({ limit: 20, ...(txq.trim() ? { q: txq.trim() } : {}) }, { enabled: txq.trim().length >= 2 });
  const create = trpc.inari.createClaim.useMutation({ onSuccess: () => { utils.invalidate(); } });
  const confirm = trpc.inari.confirmClaimMatch.useMutation({ onSuccess: () => utils.invalidate() });
  const undo = trpc.inari.undoClaimMatch.useMutation({ onSuccess: () => utils.invalidate() });
  const cancel = trpc.inari.cancelClaim.useMutation({ onSuccess: () => utils.invalidate() });
  const [kind, setKind] = useState<"refund" | "reimbursement">("refund");
  const [txId, setTxId] = useState("");
  const [expected, setExpected] = useState("");
  const [who, setWho] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const matches = trpc.inari.claimMatches.useQuery({ claimId: open ?? "" }, { enabled: !!open });
  const d = claims.data;
  const err = [create, confirm, undo, cancel].map(m => (m.error ? errMsg(m.error) : null)).find(Boolean) ?? null;

  return (
    <Panel id="claims" title="Refund Watch and reimbursements" description="Track refunds you are owed and money friends or your employer owe you. A match is only a suggestion until you confirm it; a confirmed settlement reduces the expense it repays and is never counted as income.">
      {d && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm" data-testid="claims-summary">
          <div className="rounded-md border border-wv-border p-2"><div className="text-xs text-wv-text-secondary">Refunds pending</div><b>{inrPaise(d.summary.pendingRefundPaise)}</b></div>
          <div className="rounded-md border border-wv-border p-2"><div className="text-xs text-wv-text-secondary">Overdue refunds</div><b>{d.summary.overdueRefundCount}</b></div>
          <div className="rounded-md border border-wv-border p-2"><div className="text-xs text-wv-text-secondary">Others owe you</div><b>{inrPaise(d.summary.outstandingReimbursementPaise)}</b></div>
          <div className="rounded-md border border-wv-border p-2"><div className="text-xs text-wv-text-secondary">Your real share</div><b>{inrPaise(d.summary.personalShareOfReimbursablePaise)}</b></div>
        </div>
      )}
      {d?.notes.map((n, i) => <Muted key={i}>{n}</Muted>)}
      {d?.items.map(c => (
        <div key={c.id} className="space-y-1 border-t border-wv-border pt-2 text-sm" data-testid="claim">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b>{c.kind === "refund" ? "Refund" : "Reimbursement"}</b> · {c.original ? `${c.original.narration} (${inrPaise(c.original.amountPaise)}, ${c.original.postedOn})` : "original removed"} · expected {inrPaise(c.expectedAmountPaise)}, received {inrPaise(c.receivedAmountPaise)}, outstanding {inrPaise(c.outstandingAmountPaise)} · <b>{c.status.replace(/_/g, " ")}</b>{c.counterparty ? ` · ${c.counterparty}` : ""}</span>
            <span className="flex gap-1">
              {c.status !== "cancelled" && c.status !== "received" && <button type="button" className={btnGhostCls} onClick={() => setOpen(open === c.id ? null : c.id)}>Find matching credit</button>}
              {c.status !== "cancelled" && <button type="button" className={btnGhostCls} disabled={cancel.isPending} onClick={() => cancel.mutate({ claimId: c.id })}>Cancel claim</button>}
            </span>
          </div>
          {c.settlements.map(s => (
            <div key={s.creditTransactionId} className="ml-4 flex items-center gap-2 text-xs">Confirmed {inrPaise(s.amountPaise)} on {s.confirmedAt.slice(0, 10)}
              <button type="button" className={btnGhostCls} disabled={undo.isPending} onClick={() => undo.mutate({ claimId: c.id, creditTransactionId: s.creditTransactionId })}>Undo</button></div>
          ))}
          {open === c.id && (
            <div className="ml-4 space-y-1">
              {matches.isLoading && <Muted>Looking for credits…</Muted>}
              {matches.data?.suggestions.length === 0 && <Muted>No matching credit found yet.</Muted>}
              {matches.data?.suggestions.map(m => (
                <div key={m.creditTransactionId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>{m.postedOn} · {m.narration} · {inrPaise(m.availablePaise)} available{m.ambiguous ? " · ambiguous" : ""} ({m.reasons.join("; ")})</span>
                  <button type="button" className={btnCls} disabled={confirm.isPending} onClick={() => confirm.mutate({ claimId: c.id, creditTransactionId: m.creditTransactionId })}>Confirm this credit</button>
                </div>
              ))}
              {matches.data?.notes.map((n, i) => <Muted key={i}>{n}</Muted>)}
            </div>
          )}
        </div>
      ))}
      {d && d.items.length === 0 && <Muted>No claims yet. Add one below.</Muted>}
      <div className="space-y-2 border-t border-wv-border pt-3">
        <h3 className="text-sm font-semibold">Start tracking a claim</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Type<select className={`${fieldCls} block`} value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="refund">Refund I am waiting for</option><option value="reimbursement">Money others owe me</option></select></label>
          <label className="text-sm">Find the payment<input className={`${fieldCls} block`} value={txq} onChange={e => { setTxq(e.target.value); setTxId(""); }} placeholder="e.g. amazon" aria-label="Search for the original payment" /></label>
          {txs.data && txs.data.items.length > 0 && (
            <label className="text-sm">Payment
              <select className={`${fieldCls} block max-w-[20rem]`} value={txId} onChange={e => setTxId(e.target.value)} aria-label="Original payment">
                <option value="">Choose…</option>
                {txs.data.items.filter(t => t.direction === "debit").map(t => <option key={t.id} value={t.id}>{t.postedOn} {inr(t.amount)} {t.merchant ?? t.narration}</option>)}
              </select></label>
          )}
          <label className="text-sm">Expected ₹<input className={`${fieldCls} block w-28`} inputMode="decimal" value={expected} onChange={e => setExpected(e.target.value)} aria-label="Expected amount in rupees" /></label>
          {kind === "reimbursement" && <label className="text-sm">From<input className={`${fieldCls} block w-32`} value={who} onChange={e => setWho(e.target.value)} placeholder="Rahul" /></label>}
          <button type="button" className={btnCls} disabled={!txId || !(Number(expected) > 0) || create.isPending}
            onClick={() => create.mutate({ kind, transactionId: txId, expectedAmount: Number(expected), ...(who.trim() ? { counterparty: who.trim() } : {}) }, { onSuccess: () => { setExpected(""); setWho(""); setTxId(""); setTxq(""); } })}>Add claim</button>
        </div>
      </div>
      <Err msg={err ?? (claims.error ? errMsg(claims.error) : null)} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- goals (user-defined, ledger-linked) */
const GOAL_TYPES = ["emergency_fund", "house", "car", "education", "retirement", "travel", "wedding", "gadget", "debt_free", "custom"] as const;
export function GoalsPanel() {
  const utils = trpc.useUtils();
  const goals = trpc.inari.getGoals.useQuery();
  const upsert = trpc.inari.upsertGoal.useMutation({ onSuccess: () => utils.invalidate() });
  const del = trpc.inari.deleteGoal.useMutation({ onSuccess: () => utils.invalidate() });
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState({ goalType: "emergency_fund" as (typeof GOAL_TYPES)[number], name: "", targetAmount: "", currentAmount: "0", timelineMonths: "", monthlyContribution: "", priority: "medium" as "low" | "medium" | "high" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(v => ({ ...v, [k]: e.target.value }));
  const d = goals.data;
  const reset = () => { setEditing(null); setF({ goalType: "emergency_fund", name: "", targetAmount: "", currentAmount: "0", timelineMonths: "", monthlyContribution: "", priority: "medium" }); };
  const save = () => {
    const target = Number(f.targetAmount);
    if (!(target > 0)) return;
    upsert.mutate({
      ...(editing ? { id: editing } : {}), goalType: f.goalType, ...(f.name.trim() ? { name: f.name.trim() } : {}), targetAmount: target, currentAmount: Number(f.currentAmount) || 0,
      ...(f.timelineMonths.trim() ? { timelineMonths: Math.round(Number(f.timelineMonths)) } : {}), ...(f.monthlyContribution.trim() ? { monthlyContribution: Number(f.monthlyContribution) } : {}), priority: f.priority,
    }, { onSuccess: reset });
  };
  return (
    <Panel id="my-goals" title="Your goals" description="Goals use only the balances and contributions you confirm here. Nothing is assumed.">
      {goals.isLoading && <Muted>Loading goals…</Muted>}
      {d?.summary && (
        <Muted>Planned saving per month: {inr(d.summary.totalMonthlyContributions)}{d.summary.monthlySurplus !== null ? ` of your ${inr(d.summary.monthlySurplus)} monthly surplus${d.summary.withinSurplus === false ? " (this exceeds your surplus)" : ""}.` : ". Import a complete month to compare with your surplus."}</Muted>
      )}
      {d?.warnings?.map((w, i) => <Note key={i} tone="warn">{w}</Note>)}
      {d && d.items.length === 0 && <Muted>No goals yet. Create one below.</Muted>}
      {d?.items.map(g => (
        <div key={g.id} className="space-y-1 border-t border-wv-border pt-2 text-sm" data-testid="goal">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><b>{g.name}</b> · {inr(g.currentAmount)} of {inr(g.targetAmount)} ({g.progressPercent.toFixed(1)}%) · {g.status?.replace(/_/g, " ") ?? ""}</span>
            <span className="flex gap-1">
              <button type="button" className={btnGhostCls} onClick={() => { setEditing(g.id); setF({ goalType: g.goalType, name: g.name, targetAmount: String(g.targetAmount), currentAmount: String(g.currentAmount), timelineMonths: g.timelineMonths ? String(g.timelineMonths) : "", monthlyContribution: g.monthlyContribution != null ? String(g.monthlyContribution) : "", priority: g.priority }); }}>Edit</button>
              <button type="button" className={btnGhostCls} disabled={del.isPending} onClick={() => { if (window.confirm(`Delete goal “${g.name}”?`)) del.mutate({ id: g.id }); }}>Delete</button>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-wv-border"><div className="h-2 bg-wv-primary" style={{ width: `${Math.min(100, g.progressPercent)}%` }} /></div>
          <p className="text-xs text-wv-text-secondary">
            {g.projectedCompletion ? `Projected completion ${g.projectedCompletion}. ` : ""}{g.requiredMonthly != null ? `Needs ${inr(g.requiredMonthly)} a month for the deadline. ` : ""}{g.monthlyContribution != null ? `You plan ${inr(g.monthlyContribution)} a month.` : "No monthly contribution entered, so no projection."}
          </p>
          {(g.notes ?? []).map((n, i) => <p key={i} className="text-xs text-wv-text-secondary">{n}</p>)}
        </div>
      ))}
      <div className="space-y-2 border-t border-wv-border pt-3">
        <h3 className="text-sm font-semibold">{editing ? "Update goal" : "Create a goal"}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Type<select className={`${fieldCls} block`} value={f.goalType} onChange={set("goalType")}>{GOAL_TYPES.map(g => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}</select></label>
          <label className="text-sm">Name<input className={`${fieldCls} block w-36`} value={f.name} onChange={set("name")} maxLength={80} /></label>
          <label className="text-sm">Target ₹<input className={`${fieldCls} block w-28`} inputMode="decimal" value={f.targetAmount} onChange={set("targetAmount")} aria-label="Goal target in rupees" /></label>
          <label className="text-sm">Saved so far ₹<input className={`${fieldCls} block w-28`} inputMode="decimal" value={f.currentAmount} onChange={set("currentAmount")} aria-label="Amount saved so far in rupees" /></label>
          <label className="text-sm">Months to go<input className={`${fieldCls} block w-24`} inputMode="numeric" value={f.timelineMonths} onChange={set("timelineMonths")} aria-label="Timeline in months" /></label>
          <label className="text-sm">Monthly ₹<input className={`${fieldCls} block w-28`} inputMode="decimal" value={f.monthlyContribution} onChange={set("monthlyContribution")} aria-label="Monthly contribution in rupees" /></label>
          <label className="text-sm">Priority<select className={`${fieldCls} block`} value={f.priority} onChange={set("priority")}><option>low</option><option>medium</option><option>high</option></select></label>
          <button type="button" className={btnCls} disabled={upsert.isPending || !(Number(f.targetAmount) > 0)} onClick={save}>{editing ? "Save changes" : "Add goal"}</button>
          {editing && <button type="button" className={btnGhostCls} onClick={reset}>Cancel</button>}
        </div>
      </div>
      <Err msg={upsert.error ? errMsg(upsert.error) : del.error ? errMsg(del.error) : goals.error ? errMsg(goals.error) : null} />
    </Panel>
  );
}

/* ---------------------------------------------------------------- balances the user chooses to confirm */
export function BalancesPanel() {
  const utils = trpc.useUtils();
  const snap = trpc.inari.getSnapshot.useQuery();
  const save = trpc.inari.setBalances.useMutation({ onSuccess: () => utils.invalidate() });
  const [v, setV] = useState({ emergencyFund: "", investments: "", creditCardDebt: "" });
  const b = snap.data?.balances;
  const parse = (s: string) => (s.trim() === "" ? null : Number(s));
  return (
    <Panel id="balances" title="Balances you confirm" description="Statements cannot tell INARI your savings or debt. Enter a balance only if you know it; leave blank to keep it “Not provided”.">
      <p className="text-sm">Emergency fund: <b>{inr(b?.emergencyFund)}</b> · Investments: <b>{inr(b?.investments)}</b> · Card debt: <b>{inr(b?.creditCardDebt)}</b></p>
      <div className="flex flex-wrap items-end gap-2">
        {([["emergencyFund", "Emergency fund ₹"], ["investments", "Investments ₹"], ["creditCardDebt", "Card debt ₹"]] as const).map(([k, l]) => (
          <label key={k} className="text-sm">{l}<input className={`${fieldCls} block w-32`} inputMode="decimal" value={v[k]} onChange={e => setV(s => ({ ...s, [k]: e.target.value }))} aria-label={l} /></label>
        ))}
        <button type="button" className={btnCls} disabled={save.isPending || Object.values(v).every(x => x.trim() === "")}
          onClick={() => save.mutate({ emergencyFund: parse(v.emergencyFund) ?? (b?.emergencyFund ?? null), investments: parse(v.investments) ?? (b?.investments ?? null), creditCardDebt: parse(v.creditCardDebt) ?? (b?.creditCardDebt ?? null) }, { onSuccess: () => setV({ emergencyFund: "", investments: "", creditCardDebt: "" }) })}>Save balances</button>
      </div>
      <Err msg={save.error ? errMsg(save.error) : null} />
    </Panel>
  );
}
