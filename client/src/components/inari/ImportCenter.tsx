import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { ImportPreview } from "@shared/inari/contracts";
import { Err, Muted, Note, Panel, btnCls, btnGhostCls, errMsg, fieldCls, inr } from "./kit";

type Status = ImportPreview["rows"][number]["status"];
const STATUS_LABEL: Record<Status, string> = { accepted: "New", duplicate: "Already imported", possible_duplicate: "Possible duplicate", rejected: "Rejected", ignored: "Ignored" };
const STATUS_TONE: Record<Status, string> = {
  accepted: "text-wv-success", duplicate: "text-wv-text-secondary", possible_duplicate: "text-amber-700", rejected: "text-wv-error", ignored: "text-wv-text-secondary",
};

function toBase64(bytes: ArrayBuffer) {
  let bin = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  return btoa(bin);
}

/** Import Center: preview, review, explicit commit, history and undo for CSV, digital PDF and SMS alerts. */
export function ImportCenter({ onChanged }: { onChanged?: () => void }) {
  const utils = trpc.useUtils();
  const preview = trpc.inari.importPreview.useMutation();
  const commit = trpc.inari.importCommit.useMutation();
  const undo = trpc.inari.importUndo.useMutation();
  const clear = trpc.inari.clearMyData.useMutation();
  const history = trpc.inari.importHistory.useQuery();
  const [label, setLabel] = useState("");
  const [smsText, setSmsText] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [lastPdf, setLastPdf] = useState<{ filename: string; contentBase64: string } | null>(null);
  const [include, setInclude] = useState<Set<number>>(new Set());
  const [includeAll, setIncludeAll] = useState(false);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const changed = () => { utils.invalidate(); onChanged?.(); };
  const reset = () => { setInclude(new Set()); setIncludeAll(false); setFilter("all"); };

  const run = (input: Parameters<typeof preview.mutate>[0], name: string) => {
    setDone(null); setLabel(name); reset();
    preview.mutate(input);
  };
  const sendPdf = (filename: string, contentBase64: string, password?: string) => {
    setLastPdf({ filename, contentBase64 });
    run({ kind: "pdf", filename, contentBase64, ...(password ? { password } : {}) }, filename);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (/\.pdf$/i.test(f.name)) sendPdf(f.name, toBase64(await f.arrayBuffer()));
    else if (/\.txt$/i.test(f.name)) { const t = await f.text(); setSmsText(t); run({ kind: "sms", text: t }, f.name); }
    else run({ kind: "csv", filename: f.name, content: await f.text() }, f.name);
  };
  const loadSample = async (kind: "csv" | "pdf" | "sms") => {
    if (kind === "csv") run({ kind: "csv", filename: "synthetic_statement.csv", content: await (await fetch("/demo/synthetic_statement.csv")).text() }, "synthetic_statement.csv");
    else if (kind === "pdf") sendPdf("synthetic_statement.pdf", toBase64(await (await fetch("/demo/synthetic_statement.pdf")).arrayBuffer()));
    else { const t = await (await fetch("/demo/synthetic_sms.txt")).text(); setSmsText(t); run({ kind: "sms", text: t }, "SMS alerts"); }
  };

  const p = preview.data;
  const possible = p?.rows.filter(r => r.status === "possible_duplicate") ?? [];
  const shownRows = useMemo(() => (p?.rows ?? []).filter(r => filter === "all" || r.status === filter), [p, filter]);
  const willWrite = p ? p.counts.accepted + (includeAll ? p.counts.possibleDuplicate : include.size) : 0;
  const toggle = (n: number) => setInclude(s => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });

  const doCommit = () => {
    if (!p) return;
    commit.mutate(
      { previewId: p.previewId, ...(includeAll ? { importAllPossibleDuplicates: true } : { importPossibleDuplicateRows: Array.from(include) }) },
      {
        onSuccess: b => {
          const c = b.counts;
          setDone(`Imported ${c.written ?? c.accepted} transaction(s). Skipped ${c.duplicate} already-imported row(s)${c.possibleDuplicate ? `; ${c.possibleDuplicate} possible duplicate(s) were flagged for review` : ""}. Your dashboard, spending, goals, recommendations and advisor now use this data.`);
          preview.reset(); reset(); changed();
        },
      }
    );
  };
  const needsPassword = preview.error && /password/i.test(errMsg(preview.error));

  return (
    <div className="space-y-4">
      <Panel id="import" title="Import a statement" description="CSV, digital (text) PDF or pasted SMS alerts. Nothing is saved until you review the preview and confirm.">
        <p role="note" className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">Synthetic data only. Do not upload real bank statements. Files are read on the server for this demo session only; scanned (image-only) PDFs are not supported.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.pdf,.txt" aria-label="Choose statement file (CSV or PDF)" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} className="text-sm" />
          <button type="button" className={btnGhostCls} onClick={() => loadSample("csv")} disabled={preview.isPending}>Load synthetic CSV (494 rows)</button>
          <button type="button" className={btnGhostCls} onClick={() => loadSample("pdf")} disabled={preview.isPending}>Load synthetic PDF</button>
          <button type="button" className={btnGhostCls} onClick={() => loadSample("sms")} disabled={preview.isPending}>Load synthetic SMS</button>
        </div>
        <div className="space-y-1">
          <label htmlFor="sms-text" className="text-sm font-medium text-wv-text">Or paste SMS bank alerts (one per line)</label>
          <textarea id="sms-text" rows={3} maxLength={5000} className={`${fieldCls} w-full`} value={smsText} onChange={e => setSmsText(e.target.value)} placeholder="Rs.500.00 debited from A/c XX1234 on 12-09-26 to swiggy@ybl (UPI Ref No 123456789012)" />
          <button type="button" className={btnCls} disabled={!smsText.trim() || preview.isPending} onClick={() => run({ kind: "sms", text: smsText }, "SMS alerts")}>Preview SMS import</button>
        </div>
        {preview.isPending && <p role="status" className="text-sm">Reading {label}…</p>}
        <Err msg={preview.error ? errMsg(preview.error) : null} />
        {needsPassword && lastPdf && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">PDF password<input type="password" autoComplete="off" className={`${fieldCls} ml-2`} value={pdfPassword} onChange={e => setPdfPassword(e.target.value)} /></label>
            <button type="button" className={btnCls} onClick={() => sendPdf(lastPdf.filename, lastPdf.contentBase64, pdfPassword)}>Retry with password</button>
            <Note>The password is used once to read the file and is not stored.</Note>
          </div>
        )}
      </Panel>

      {p && (
        <Panel id="import-preview" title={`Preview: ${label}`} description={`Detected format ${p.detectedFormat}${p.period ? `, ${p.period.from} to ${p.period.to}` : ""}. Nothing has been saved yet.`}>
          <div data-testid="import-preview" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([["accepted", "New", p.counts.accepted], ["duplicate", "Already imported", p.counts.duplicate], ["possible_duplicate", "Possible duplicate", p.counts.possibleDuplicate], ["rejected", "Rejected", p.counts.rejected], ["ignored", "Ignored", p.counts.ignored]] as const).map(([k, l, n]) => (
              <button key={k} type="button" onClick={() => setFilter(filter === k ? "all" : k)} aria-pressed={filter === k} className={`rounded-md border p-3 text-left ${filter === k ? "border-wv-primary" : "border-wv-border"}`}>
                <div className="text-xs text-wv-text-secondary">{l}</div>
                <div className={`text-xl font-bold ${STATUS_TONE[k]}`}>{n}</div>
              </button>
            ))}
          </div>
          {p.warnings.map((w, i) => <Note key={i} tone="warn">{w}</Note>)}
          {p.rows.length < p.counts.accepted + p.counts.duplicate + p.counts.possibleDuplicate + p.counts.rejected + p.counts.ignored && <Muted>Only the first 200 rows are listed. The counts cover the whole file.</Muted>}

          {p.counts.possibleDuplicate > 0 && (
            <div className="space-y-2 rounded-md border border-amber-400 bg-amber-50 p-3" data-testid="possible-duplicates">
              <p className="text-sm font-semibold text-amber-900">Review {p.counts.possibleDuplicate} possible duplicate(s)</p>
              <p className="text-sm text-amber-900">These rows share the date, amount and direction of a transaction you already have but are worded differently (often the same payment from another statement layout). They are <b>not</b> imported unless you tick them. Tick a row only if it is a separate payment.</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeAll} onChange={e => setIncludeAll(e.target.checked)} /> Include all {p.counts.possibleDuplicate} possible duplicates as separate payments</label>
              {!includeAll && possible.map(r => (
                <label key={r.rowNumber} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={include.has(r.rowNumber)} onChange={() => toggle(r.rowNumber)} aria-label={`Include row ${r.rowNumber}`} />
                  <span>Row {r.rowNumber}: {r.transaction?.postedOn} · {r.transaction?.direction} {inr(r.transaction?.amount)} · {r.transaction?.narration}<br /><span className="text-amber-800">{r.reason}</span></span>
                </label>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-auto rounded-md border border-wv-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-wv-surface text-left text-wv-text-secondary"><tr><th className="p-2">Row</th><th>Status</th><th>Date</th><th>Description</th><th className="text-right">Amount</th><th className="p-2">Source</th></tr></thead>
              <tbody>
                {shownRows.map(r => (
                  <tr key={r.rowNumber} className="border-t border-wv-border align-top">
                    <td className="p-2">{r.rowNumber}</td>
                    <td className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}{r.reason ? <div className="text-xs text-wv-text-secondary">{r.reason}</div> : null}</td>
                    <td>{r.transaction?.postedOn ?? "—"}</td>
                    <td className="max-w-[18rem] break-words">{r.transaction?.narration ?? "—"}</td>
                    <td className="text-right">{r.transaction ? `${r.transaction.direction === "debit" ? "−" : "+"}${inr(r.transaction.amount)}` : "—"}</td>
                    <td className="p-2 text-xs text-wv-text-secondary">{r.transaction?.evidence ? `PDF p.${r.transaction.evidence.page}, line ${r.transaction.evidence.line}` : r.transaction?.source ?? ""}</td>
                  </tr>
                ))}
                {shownRows.length === 0 && <tr><td colSpan={6} className="p-3 text-wv-text-secondary">No rows in this view.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnCls} disabled={commit.isPending || willWrite === 0} onClick={doCommit}>
              {commit.isPending ? "Importing…" : willWrite === 0 ? "Nothing to import" : `Confirm import of ${willWrite} transaction${willWrite === 1 ? "" : "s"}`}
            </button>
            <button type="button" className={btnGhostCls} onClick={() => { preview.reset(); reset(); }}>Discard preview</button>
            {willWrite === 0 && <Muted>{p.counts.duplicate > 0 && p.counts.accepted === 0 ? "Every row is already in your ledger, so importing again would change nothing." : "Nothing in this file is ready to import."}</Muted>}
          </div>
          <Err msg={commit.error ? errMsg(commit.error) : null} />
        </Panel>
      )}
      {done && <p role="status" data-testid="import-done" className="rounded-md border border-wv-success/40 bg-wv-success/10 px-3 py-2 text-sm text-wv-text">{done}</p>}

      <Panel title="Import history" description="Every import is a batch. Undo removes only that batch; rows are never silently edited.">
        {history.isLoading && <Muted>Loading…</Muted>}
        {history.data && history.data.items.length === 0 && <Muted>No imports yet.</Muted>}
        {history.data?.items.map(b => (
          <div key={b.batchId} className="flex flex-wrap items-center justify-between gap-2 border-t border-wv-border pt-2 text-sm">
            <span>
              <b>{b.filename ?? b.source}</b> · {b.source.toUpperCase()} · {b.counts.written ?? b.counts.accepted} written, {b.counts.duplicate} duplicate · {b.period ? `${b.period.from} to ${b.period.to}` : "no period"} · <span className={b.status === "undone" ? "text-wv-text-secondary" : "text-wv-success"}>{b.status}</span>
            </span>
            {b.status === "committed" && (
              <button type="button" className={btnGhostCls} disabled={undo.isPending}
                onClick={() => { if (window.confirm("Undo this import? Its transactions will be removed from your ledger.")) undo.mutate({ batchId: b.batchId }, { onSuccess: () => { setDone(`Undid import of ${b.filename ?? b.source}.`); changed(); } }); }}>
                Undo import
              </button>
            )}
          </div>
        ))}
        <Err msg={undo.error ? errMsg(undo.error) : null} />
        <div className="pt-2">
          <button type="button" className={btnGhostCls} disabled={clear.isPending}
            onClick={() => { if (window.confirm("Delete ALL of your imported data and settings for this demo session?")) clear.mutate({ confirm: "DELETE" }, { onSuccess: () => { setDone("All of your data was deleted."); changed(); } }); }}>
            Delete all my data
          </button>
          <Err msg={clear.error ? errMsg(clear.error) : null} />
        </div>
      </Panel>
    </div>
  );
}
