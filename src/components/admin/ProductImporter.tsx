"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface RowPlan { line: number; slug: string; name: string; action: string; priceDisplay?: string; changed?: string[] }
interface Report {
  mode: string; total: number;
  creates: RowPlan[]; updates: RowPlan[];
  skips: { line: number; reason: string }[];
  errors: { line: number; msg: string }[];
  committed: boolean; batchId?: string; createdCount?: number; updatedCount?: number;
}

const MODE_HELP: Record<string, string> = {
  upsert: "Update products that match (by slug or SKU) and create any that are new.",
  create: "Only create products that don't exist yet. Existing ones are skipped.",
  update: "Only update existing products. New rows are skipped (nothing created).",
};

const TEMPLATE = "slug,sku,name,brand,brand_logo,type,regular_price,sale_price,on_sale,stock,low_stock_threshold,visible,categories,short_description,description,image\n";

export function ProductImporter() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState("upsert");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Report | null>(null);
  const [undone, setUndone] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setFileText(await f.text());
    setReport(null); setDone(null); setUndone(null); setError(null);
  }

  async function run(commit: boolean) {
    if (!fileText.trim()) { setError("Choose a CSV file first."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/products/import?mode=${mode}&commit=${commit ? 1 : 0}`, { method: "POST", headers: { "Content-Type": "text/csv" }, body: fileText });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Import failed."); setBusy(false); return; }
      if (commit) { setDone(d.report); setReport(null); router.refresh(); }
      else setReport(d.report);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function undo() {
    if (!done?.batchId || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/products/import/rollback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: done.batchId }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setUndone(`Undone — restored ${d.restored} and removed ${d.deleted} product(s).`); setDone(null); router.refresh(); }
      else setError(d.error ?? "Undo failed.");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "tyremall-import-template.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const hasErrors = (report?.errors.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost h-10 px-4 text-sm">{fileName ? "Choose a different file" : "Choose CSV file"}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          {fileName && <span className="text-sm text-muted">{fileName}</span>}
          <button onClick={downloadTemplate} className="ml-auto text-xs font-semibold text-volt hover:underline">Download template CSV</button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Mode</label>
          <select value={mode} onChange={(e) => { setMode(e.target.value); setReport(null); setDone(null); }} className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt">
            <option value="upsert">Update + create new</option>
            <option value="create">Create new only</option>
            <option value="update">Update existing only</option>
          </select>
          <span className="text-xs text-muted">{MODE_HELP[mode]}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={() => run(false)} disabled={busy || !fileText} className="btn btn-volt h-10 px-5 text-sm disabled:opacity-50">{busy ? "Checking…" : "Preview changes"}</button>
          {error && <span className="text-sm font-semibold text-sale">{error}</span>}
        </div>
        <p className="mt-2 text-xs text-muted">Prices in <code>regular_price</code>/<code>sale_price</code> are in cents (matches Export CSV); <code>price_retail</code>/<code>price_sale</code> are in Rand. Nothing is written until you review the preview and click Import.</p>
        <p className="mt-1 text-xs text-muted">New brand? Just type it in the <code>brand</code> column and it appears on the site automatically. Optionally add a <code>brand_logo</code> column with a link to the logo image (https://…); or upload the logo afterwards in Products → Brands.</p>
      </div>

      {report && (
        <div className="card p-5">
          <h2 className="font-display text-lg">Preview — {report.mode}</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="badge badge-pay">{report.creates.length} to create</span>
            <span className="badge badge-volt">{report.updates.length} to update</span>
            <span className="badge badge-muted">{report.skips.length} skipped</span>
            {hasErrors && <span className="badge badge-sale">{report.errors.length} errors</span>}
          </div>

          {hasErrors && (
            <div className="mt-4 rounded-lg border border-sale/40 bg-sale/10 p-3">
              <div className="text-sm font-bold text-sale">Fix these before importing — nothing will be written while there are errors:</div>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-sale">
                {report.errors.slice(0, 50).map((e, i) => <li key={i}>Line {e.line}: {e.msg}</li>)}
              </ul>
            </div>
          )}

          {(report.creates.length > 0 || report.updates.length > 0) && (
            <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2">Line</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Changes</th></tr></thead>
                <tbody>
                  {[...report.creates, ...report.updates].slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 text-muted">{r.line}</td>
                      <td className="px-3 py-1.5"><span className={`badge ${r.action === "create" ? "badge-pay" : "badge-volt"}`}>{r.action}</span></td>
                      <td className="px-3 py-1.5 text-fg">{r.name}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{r.priceDisplay}</td>
                      <td className="px-3 py-1.5 text-xs text-muted">{r.changed?.join(", ") ?? "new product"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!hasErrors && (report.creates.length > 0 || report.updates.length > 0) && (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => run(true)} disabled={busy} className="btn btn-volt h-10 px-5 text-sm disabled:opacity-50">{busy ? "Importing…" : `Import ${report.creates.length + report.updates.length} change(s)`}</button>
              <span className="text-xs text-muted">You can undo this right after.</span>
            </div>
          )}
          {!hasErrors && report.creates.length === 0 && report.updates.length === 0 && <p className="mt-4 text-sm text-muted">Nothing to import — every row was skipped (see counts above).</p>}
        </div>
      )}

      {done && (
        <div className="card border-pay/40 p-5">
          <h2 className="font-display text-lg text-pay">✓ Import complete</h2>
          <p className="mt-1 text-sm text-fg">Created {done.createdCount}, updated {done.updatedCount}. Live within ~1 min.</p>
          <div className="mt-3">
            <button onClick={undo} disabled={busy} className="btn btn-ghost h-9 px-4 text-sm disabled:opacity-50">{busy ? "Undoing…" : "Undo this import"}</button>
          </div>
          {error && <span className="mt-2 block text-sm font-semibold text-sale">{error}</span>}
        </div>
      )}
      {undone && <div className="card border-line p-5"><p className="text-sm font-semibold text-pay">{undone}</p></div>}
    </div>
  );
}
