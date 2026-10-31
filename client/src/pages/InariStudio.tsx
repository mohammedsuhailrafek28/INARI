import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import type { InariAdvisorResponse } from "@shared/inari/contracts";

/**
 * INARI demo studio (route /inari). Self-contained: uses only `trpc.inari.*`.
 * Synthetic data only. Same origin as the API, so the demo identity cookie is sent automatically.
 */

const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "Not provided" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const inrPaise = (p: number | null | undefined) => (p === null || p === undefined ? "Not provided" : inr(p / 100));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
const Err = ({ msg }: { msg: string | null }) => (msg ? <p role="alert" className="text-sm text-red-600">Error: {msg}</p> : null);

/* ---------------- import + snapshot ---------------- */
function ImportPanel({ onChanged }: { onChanged: () => void }) {
  const preview = trpc.inari.importPreview.useMutation();
  const commit = trpc.inari.importCommit.useMutation();
  const clear = trpc.inari.clearMyData.useMutation();
  const [done, setDone] = useState<string | null>(null);
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async (filename: string, bytes: ArrayBuffer | null, text: string | null) => {
    setDone(null);
    setName(filename);
    if (/\.pdf$/i.test(filename) && bytes) {
      let bin = "";
      const u8 = new Uint8Array(bytes);
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
      preview.mutate({ kind: "pdf", filename, contentBase64: btoa(bin) });
    } else preview.mutate({ kind: "csv", filename, content: text ?? "" });
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (/\.pdf$/i.test(f.name)) await send(f.name, await f.arrayBuffer(), null);
    else await send(f.name, null, await f.text());
  };
  const loadSample = async () => {
    const r = await fetch("/demo/synthetic_statement.csv");
    await send("synthetic_statement.csv", null, await r.text());
  };
  const p = preview.data;
  return (
    <Section title="1. Import a statement (CSV or PDF)" id="import">
      <p className="text-sm text-muted-foreground">Synthetic data only. Do not upload real bank statements.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input ref={fileRef} type="file" accept=".csv,.pdf" aria-label="Choose statement file" onChange={e => onFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" onClick={loadSample} disabled={preview.isPending}>Load synthetic sample</Button>
      </div>
      {preview.isPending && <p>Reading {name}…</p>}
      <Err msg={preview.error ? errMsg(preview.error) : null} />
      {p && (
        <div className="space-y-2" data-testid="import-preview">
          <p className="text-sm">
            Format <b>{p.detectedFormat}</b>: {p.counts.accepted} new, {p.counts.duplicate} duplicate, {p.counts.possibleDuplicate} possible duplicate, {p.counts.rejected} rejected, {p.counts.ignored} ignored
            {p.period ? ` (${p.period.from} to ${p.period.to})` : ""}. Nothing is saved until you confirm.
          </p>
          {p.warnings.map((w, i) => <p key={i} className="text-sm text-amber-700">{w}</p>)}
          {p.rows.filter(r => r.status === "rejected").slice(0, 5).map(r => <p key={r.rowNumber} className="text-sm text-red-600">Row {r.rowNumber} rejected: {r.reason}</p>)}
          <Button type="button" disabled={commit.isPending || p.counts.accepted === 0}
            onClick={() => commit.mutate({ previewId: p.previewId }, { onSuccess: b => { setDone(`Imported ${b.counts.accepted} transactions.`); preview.reset(); onChanged(); } })}>
            {commit.isPending ? "Importing…" : `Confirm import of ${p.counts.accepted} transactions`}
          </Button>
          <Err msg={commit.error ? errMsg(commit.error) : null} />
        </div>
      )}
      {done && <p role="status" className="text-sm text-green-700">{done}</p>}
      <Button type="button" variant="ghost" size="sm" disabled={clear.isPending}
        onClick={() => { if (window.confirm("Delete all of your imported data?")) clear.mutate({ confirm: "DELETE" }, { onSuccess: () => { setDone("All data deleted."); onChanged(); } }); }}>
        Delete my data
      </Button>
    </Section>
  );
}

function SnapshotPanel() {
  const q = trpc.inari.getSnapshot.useQuery();
  const s = q.data;
  return (
    <Section title="2. Your financial snapshot" id="snapshot">
      {q.isLoading && <p>Loading…</p>}
      <Err msg={q.error ? errMsg(q.error) : null} />
      {s && (s.coverage.transactionCount === 0 ? <p className="text-sm">No data yet. Import a statement above.</p> : (
        <div data-testid="snapshot" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[["Monthly income", inr(s.monthlyIncome)], ["Monthly expenses", inr(s.monthlyExpenses)], ["Monthly surplus", inr(s.monthlySurplus)],
            ["Savings rate", s.savingsRate === null ? "Not provided" : `${s.savingsRate.toFixed(2)}%`]].map(([l, v]) => (
            <div key={l} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="font-semibold">{v}</div></div>
          ))}
          <p className="col-span-full text-xs text-muted-foreground">{s.coverage.transactionCount} transactions, {s.coverage.firstDate} to {s.coverage.lastDate}. Balances you did not enter are shown as not provided, never guessed.</p>
        </div>
      ))}
    </Section>
  );
}

/* ---------------- advisor ---------------- */
type Msg = { q: string; r?: InariAdvisorResponse; error?: string };
function ActionCard({ a, onDone }: { a: NonNullable<InariAdvisorResponse["proposedActions"]>[number]; onDone: () => void }) {
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
      setState("done"); setMsg("Done."); utils.invalidate(); onDone();
    } catch (e) { setState("error"); setMsg(errMsg(e)); }
  };
  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2" data-testid="action-card">
      <div className="font-medium">{a.title}</div>
      <div className="text-sm text-muted-foreground">{a.description} Nothing happens until you confirm.</div>
      {missing.filter(f => f !== "idempotencyKey").map(f => (
        <label key={f} className="block text-sm">{f}
          <input className="mt-1 w-full rounded border px-2 py-1" value={vals[f] ?? ""} onChange={e => setVals(v => ({ ...v, [f]: e.target.value }))} />
        </label>
      ))}
      <Button type="button" size="sm" disabled={!complete || state === "busy" || state === "done"} onClick={run}>
        {state === "done" ? "Confirmed" : state === "busy" ? "Working…" : "Confirm"}
      </Button>
      {msg && <p className={`text-sm ${state === "error" ? "text-red-600" : "text-green-700"}`}>{msg}</p>}
    </div>
  );
}

function AdvisorPanel({ onChanged }: { onChanged: () => void }) {
  const ask = trpc.inari.ask.useMutation();
  const [text, setText] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const [context, setContext] = useState<InariAdvisorResponse["context"]>(undefined);
  const submit = () => {
    const question = text.trim(); // only outer whitespace is trimmed; corrections inside the text are sent as spoken
    if (!question || ask.isPending) return;
    setText("");
    ask.mutate({ question, locale: "en", ...(context ? { previous: context } : {}) }, {
      onSuccess: r => { setContext(r.context); setLog(l => [...l, { q: question, r }]); },
      onError: e => setLog(l => [...l, { q: question, error: errMsg(e) }]),
    });
  };
  const last = log[log.length - 1];
  return (
    <Section title="3. Ask INARI (type or dictate)" id="advisor">
      <label htmlFor="advisor-input" className="text-sm text-muted-foreground">Click here, then use Wispr Flow (or type). Enter sends; Shift+Enter adds a line.</label>
      <textarea id="advisor-input" data-testid="advisor-input" autoFocus rows={3} maxLength={1000} value={text} spellCheck={false}
        placeholder="e.g. How much did I spend on dining last month?"
        className="w-full rounded border p-2" onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
      <div className="flex gap-2 items-center">
        <Button type="button" onClick={submit} disabled={ask.isPending || !text.trim()}>{ask.isPending ? "Thinking…" : "Ask"}</Button>
        {context && <Button type="button" variant="ghost" size="sm" onClick={() => { setContext(undefined); setLog([]); }}>New conversation</Button>}
        <span className="text-xs text-muted-foreground">{text.length}/1000</span>
      </div>
      {ask.isPending && <p role="status">Calculating from your ledger…</p>}
      {log.map((m, i) => (
        <div key={i} className="space-y-2 border-t pt-3" data-testid="advisor-turn">
          <p className="text-sm"><b>You:</b> {m.q}</p>
          {m.error && <p role="alert" className="text-red-600 text-sm">Error: {m.error}. Your question was not answered; try again.</p>}
          {m.r && (
            <div className="space-y-2">
              <p data-testid="advisor-answer">{m.r.answer}</p>
              <p className="text-xs text-muted-foreground" data-testid="engine-badge">
                {m.r.engine?.llmUsed === false || m.r.mode === "fallback" ? "Deterministic financial reasoning: calculated from your ledger, no language model used." : `Model-assisted (${m.r.engine?.model ?? "model"})`}
                {` · confidence ${m.r.confidenceLevel} · guardrail ${m.r.guardrail.status}`}
              </p>
              {m.r.relatedMetrics.length > 0 && <ul className="text-sm list-disc pl-5">{m.r.relatedMetrics.map((x, j) => <li key={j}>{x.label}: {x.value}</li>)}</ul>}
              {(m.r.limitations ?? []).map((x, j) => <p key={j} className="text-xs text-amber-700">{x}</p>)}
              {m.r.intent?.needsClarification && <p className="text-sm text-amber-700">{m.r.intent.clarificationQuestion}</p>}
              {i === log.length - 1 && (m.r.proposedActions ?? []).map((a, j) => <ActionCard key={`${i}-${j}`} a={a} onDone={onChanged} />)}
              {i === log.length - 1 && m.r.followUpQuestions.length > 0 && (
                <div className="flex flex-wrap gap-2">{m.r.followUpQuestions.slice(0, 3).map(f => <Button key={f} type="button" variant="outline" size="sm" onClick={() => setText(f)}>{f}</Button>)}</div>
              )}
            </div>
          )}
        </div>
      ))}
      {!last && <p className="text-xs text-muted-foreground">Try: “Where is my refund?”, “I spent ₹350 cash yesterday.”, “Is this EMI actually cheaper?”, “What if my income drops by ten thousand?”</p>}
    </Section>
  );
}

/* ---------------- what-if ---------------- */
function WhatIfPanel() {
  const sim = trpc.inari.simulate.useMutation();
  const [kind, setKind] = useState<"income" | "category">("income");
  const [amount, setAmount] = useState("-10000");
  const [category, setCategory] = useState("dining");
  const run = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return;
    sim.mutate({ scenarios: [kind === "income" ? { type: "change_income", deltaPerMonth: n } : { type: "reduce_category", category: category as never, amountPerMonth: Math.abs(n) }] });
  };
  const r = sim.data;
  return (
    <Section title="4. What-if scenario (changes nothing)" id="whatif">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">Scenario
          <select className="block rounded border px-2 py-1" value={kind} onChange={e => setKind(e.target.value as "income" | "category")}>
            <option value="income">Change monthly income by</option><option value="category">Reduce a category by</option>
          </select></label>
        {kind === "category" && (
          <label className="text-sm">Category
            <select className="block rounded border px-2 py-1" value={category} onChange={e => setCategory(e.target.value)}>
              {["dining", "shopping", "entertainment", "groceries", "transport", "subscription"].map(c => <option key={c}>{c}</option>)}
            </select></label>
        )}
        <label className="text-sm">₹ per month
          <input className="block rounded border px-2 py-1 w-32" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <Button type="button" onClick={run} disabled={sim.isPending}>{sim.isPending ? "Running…" : "Run scenario"}</Button>
      </div>
      <Err msg={sim.error ? errMsg(sim.error) : null} />
      {r && (r.status === "insufficient_data" ? <p className="text-sm">Not enough data to simulate. Import a statement first.</p> : (
        <table className="text-sm w-full" data-testid="whatif-result">
          <thead><tr className="text-left text-muted-foreground"><th>Metric</th><th>Now</th><th>Scenario</th></tr></thead>
          <tbody>{r.metrics.map(m => (
            <tr key={m.label}><td>{m.label}</td>
              <td>{m.unit === "inr" ? inr(m.baseline) : m.baseline ?? "—"}{m.unit === "percent" ? "%" : ""}</td>
              <td>{m.unit === "inr" ? inr(m.scenario) : m.scenario ?? "—"}{m.unit === "percent" ? "%" : ""}</td></tr>
          ))}</tbody>
        </table>
      ))}
      {r && <p className="text-xs text-muted-foreground">{r.disclaimer} Your ledger was not changed.</p>}
    </Section>
  );
}

/* ---------------- monthly report ---------------- */
function ReportPanel() {
  const months = trpc.inari.listReportMonths.useQuery();
  const [picked, setPicked] = useState<string | null>(null);
  const list = months.data?.months ?? [];
  const month = picked ?? [...list].sort().at(-1) ?? null;
  const rep = trpc.inari.monthlyReport.useQuery({ month: month ?? "2000-01" }, { enabled: !!month });
  const r = rep.data;
  return (
    <Section title="5. Monthly report" id="report">
      {list.length === 0 && <p className="text-sm">No months available yet. Import a statement first.</p>}
      {list.length > 0 && (
        <label className="text-sm">Month <select className="rounded border px-2 py-1" value={month ?? ""} onChange={e => setPicked(e.target.value)}>
          {list.map(m => <option key={m}>{m}</option>)}</select></label>
      )}
      <Err msg={rep.error ? errMsg(rep.error) : null} />
      {r && r.status === "ok" && (
        <div className="space-y-2" data-testid="report">
          <p className="font-medium">{r.narrative.headline}</p>
          <p className="text-sm">{r.narrative.body}</p>
          <p className="text-sm">Income {inr(r.totals.income)} · Expenses {inr(r.totals.expenses)} · Savings rate {r.totals.savingsRate.toFixed(2)}%</p>
          <ul className="text-sm list-disc pl-5">{r.categories.slice(0, 5).map(c => <li key={c.category}>{c.category}: {inr(c.amount)} ({c.sharePercent.toFixed(1)}%)</li>)}</ul>
          {r.actions.map(a => <p key={a.title} className="text-sm"><b>{a.title}</b>: {a.reason}</p>)}
          {r.period?.partial && <p className="text-xs text-amber-700">Partial month: {r.period.reason}</p>}
        </div>
      )}
      {r && r.status !== "ok" && <p className="text-sm">Not enough data for this month.</p>}
    </Section>
  );
}

/* ---------------- EMI check (novelty) ---------------- */
function EmiPanel() {
  const emi = trpc.inari.emiCheck.useMutation();
  const [f, setF] = useState({ cashPrice: "40000", emiMonthly: "6700", months: "6", processingFee: "500" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(v => ({ ...v, [k]: e.target.value }));
  const run = () => emi.mutate({
    cashPrice: Number(f.cashPrice), emiMonthly: Number(f.emiMonthly), months: Number(f.months),
    ...(f.processingFee.trim() ? { processingFee: Number(f.processingFee) } : {}),
  });
  const r = emi.data;
  return (
    <Section title="6. Is this “no-cost EMI” really free?" id="emi">
      <div className="flex flex-wrap gap-2 items-end">
        {([["cashPrice", "Cash price ₹"], ["emiMonthly", "Monthly instalment ₹"], ["months", "Months"], ["processingFee", "Processing fee ₹ (optional)"]] as const).map(([k, l]) => (
          <label key={k} className="text-sm">{l}<input className="block rounded border px-2 py-1 w-36" inputMode="decimal" value={f[k]} onChange={set(k)} /></label>
        ))}
        <Button type="button" onClick={run} disabled={emi.isPending}>Check</Button>
      </div>
      <Err msg={emi.error ? errMsg(emi.error) : null} />
      {r && (
        <div className="space-y-1 text-sm" data-testid="emi-result">
          <p className="font-medium">{r.verdict}</p>
          <p>Upfront {inrPaise(r.totalPayableUpfrontPaise)} vs EMI total {inrPaise(r.totalPayableEmiPaise)} (extra {inrPaise(r.extraCostOfEmiPaise)}). Monthly commitment {inrPaise(r.monthlyCommitmentPaise)}.</p>
          {r.missingTerms.length > 0 && <p className="text-amber-700">Not provided (counted as zero): {r.missingTerms.join("; ")}.</p>}
          <p className="text-xs text-muted-foreground">Calculation only. This creates no debt and no transaction.</p>
        </div>
      )}
    </Section>
  );
}

export default function InariStudio() {
  const utils = trpc.useUtils();
  const changed = () => { utils.invalidate(); };
  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">INARI</h1>
        <p className="text-sm text-muted-foreground">Voice-first money coach. Answers are calculated from your own statement data.</p>
        <p role="note" className="rounded border border-amber-400 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          Demo build: use synthetic data only. Your session is a temporary demo identity (not real sign-in) and data is kept in server memory, so it can disappear on restart.
        </p>
      </header>
      <ImportPanel onChanged={changed} />
      <SnapshotPanel />
      <AdvisorPanel onChanged={changed} />
      <WhatIfPanel />
      <ReportPanel />
      <EmiPanel />
    </main>
  );
}
