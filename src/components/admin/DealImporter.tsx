"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";

interface Plan { line: number; action: string; slug: string; name: string; sku: string; priceDisplay: string; stock: number; original?: { slug: string; name: string } | null; photo: "file" | "copied" | "missing"; details?: string[] }
interface Report {
  special: string; total: number; creates: Plan[]; updates: Plan[];
  errors: { line: number; msg: string }[]; missingPhotos: { line: number; name: string; sku: string }[];
  committed: boolean; batchId?: string; createdCount?: number; updatedCount?: number;
}

const PHOTO: Record<Plan["photo"], string> = { file: "from file", copied: "copied from shop product", missing: "⚠ no photo" };

/** Import deal products (own SKU, price, stock) into one special / sale. Kept
 *  apart from Products → Import so standard shop products are never changed. */
export function DealImporter({ specialId, specialName }: { specialId: number; specialName: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [done, setDone] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setText(await f.text());
    setReport(null); setDone(null); setError(null); setMsg(null);
  }

  async function run(commit: boolean) {
    if (!text.trim()) { setError("Choose a CSV file first."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/specials/${specialId}/import?commit=${commit ? 1 : 0}`, { method: "POST", headers: { "Content-Type": "text/csv" }, body: text });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error ?? "Import failed.");
      else if (commit) { setDone(d.report); setReport(null); router.refresh(); }
      else setReport(d.report);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function undo() {
    if (!done?.batchId) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/specials/${specialId}/import/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: done.batchId }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setMsg(`Undone — removed ${d.deleted} and restored ${d.restored} deal product(s).`); setDone(null); router.refresh(); }
    else setError(d.error ?? "Undo failed.");
  }

  const plans = report ? [...report.creates, ...report.updates] : [];
  const hasErrors = (report?.errors.length ?? 0) > 0;

  return (
    <div className="mt-4 rounded-xl border border-line p-3">
      <b className="text-sm">Import deal products (CSV)</b>
      <p className="mt-1 text-xs text-muted">
        For deals like Black Friday combos: each row becomes a <b className="text-fg">separate deal product in “{specialName}” only</b>, with its own SKU, price and stock.
        Your normal shop products are never changed — a row using a shop product&apos;s SKU is refused. The old WooCommerce export layout works as it is
        (post_title, post_name, regular_price in Rand, stock, images, post_content, attribute:pa_tyre-size…), or use: <code>sku</code>, <code>name</code>, <code>price</code> (Rand), <code>stock</code>,
        <code>original_sku</code> (the normal shop product it&apos;s based on), <code>image</code>, <code>short_description</code>, <code>long_description</code>, <code>tyre_size</code>, <code>width</code>, <code>profile</code>, <code>rim</code>.
        Anything left blank — photo, tyre size, description, brand — is copied from the normal shop product (matched by <code>original_sku</code> or the row&apos;s slug / post_name).
        Deal products show in the shop, search and this special while it runs, and are hidden automatically when it ends.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost h-9 px-3 text-sm">{fileName ? "Choose a different file" : "Choose CSV file"}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        {fileName && <span className="text-xs text-muted">{fileName}</span>}
        <button type="button" onClick={() => run(false)} disabled={busy || !text} className="btn btn-volt h-9 px-4 text-sm disabled:opacity-50">{busy ? "Checking…" : "Preview"}</button>
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-sale">{error}</p>}
      {msg && <p className="mt-2 text-sm font-semibold text-pay">{msg}</p>}

      {report && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="badge badge-pay">{report.creates.length} new deal product{report.creates.length === 1 ? "" : "s"}</span>
            <span className="badge badge-volt">{report.updates.length} to update</span>
            {hasErrors && <span className="badge badge-sale">{report.errors.length} problem{report.errors.length === 1 ? "" : "s"}</span>}
            {report.missingPhotos.length > 0 && <span className="badge badge-warn">{report.missingPhotos.length} without a photo</span>}
          </div>
          {hasErrors && (
            <div className="mt-2 rounded-lg border border-sale/40 bg-sale/10 p-3">
              <div className="text-sm font-bold text-sale">Fix these first — nothing is imported while there are problems:</div>
              <ul className="mt-1 max-h-48 space-y-1 overflow-auto text-xs text-sale">{report.errors.map((e, i) => <li key={i}>Line {e.line}: {e.msg}</li>)}</ul>
            </div>
          )}
          {report.missingPhotos.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
              <b>No photo for:</b> {report.missingPhotos.map((m) => `${m.name} (SKU ${m.sku})`).join(" · ")}. Their photo links point to the old WordPress site (gone) and there&apos;s no matching shop product to copy from —
              add an <code>image</code> link or upload the photos in Media and edit these products after importing.
            </div>
          )}
          {plans.length > 0 && (
            <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-line uppercase tracking-wide text-muted"><th className="px-2.5 py-2">Line</th><th className="px-2.5 py-2">SKU</th><th className="px-2.5 py-2">Deal product</th><th className="px-2.5 py-2">Price</th><th className="px-2.5 py-2">Stock</th><th className="px-2.5 py-2">Based on (unchanged)</th><th className="px-2.5 py-2">Photo</th></tr></thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.line} className="border-b border-line align-top last:border-0">
                      <td className="px-2.5 py-1.5 text-muted">{p.line}</td>
                      <td className="whitespace-nowrap px-2.5 py-1.5 font-semibold text-fg">{p.sku}</td>
                      <td className="px-2.5 py-1.5 text-fg"><span className={`badge ${p.action === "create" ? "badge-pay" : "badge-volt"} mr-1`}>{p.action === "create" ? "new" : "update"}</span>{p.name}<div className="text-muted">/product/{p.slug}</div></td>
                      <td className="whitespace-nowrap px-2.5 py-1.5">{p.priceDisplay}</td>
                      <td className="px-2.5 py-1.5">{p.stock}</td>
                      <td className="px-2.5 py-1.5 text-muted">{p.original ? p.original.name : "—"}</td>
                      <td className={`px-2.5 py-1.5 ${p.photo === "missing" ? "text-amber-300" : "text-muted"}`}>{PHOTO[p.photo]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!hasErrors && plans.length > 0 && (
            <button type="button" onClick={() => (report.updates.length ? setConfirm(true) : run(true))} disabled={busy} className="btn btn-volt mt-3 h-9 px-4 text-sm disabled:opacity-50">
              {busy ? "Importing…" : `Import ${plans.length} deal product${plans.length === 1 ? "" : "s"} into “${specialName}”`}
            </button>
          )}
          {!hasErrors && !plans.length && <p className="mt-2 text-sm text-muted">Nothing to import — every row is already up to date.</p>}
          <ConfirmDialog open={confirm} busy={busy} danger wide
            title={`It looks like you're about to update ${report.updates.length} existing deal product${report.updates.length === 1 ? "" : "s"} in “${specialName}”. Is that OK?`}
            yesLabel="Yes, update them" noLabel="No, cancel" onNo={() => setConfirm(false)} onYes={() => { setConfirm(false); void run(true); }}>
            <ul className="max-h-72 space-y-2 overflow-auto text-xs">
              {report.updates.map((u) => <li key={u.line}><b className="text-fg">{u.sku}</b> · {u.name}<div className="text-muted">{u.details?.join(" · ")}</div></li>)}
            </ul>
          </ConfirmDialog>
        </div>
      )}

      {done && (
        <div className="mt-3 rounded-lg border border-pay/40 bg-pay/10 p-3 text-sm">
          <b className="text-pay">✓ Imported:</b> {done.createdCount} added, {done.updatedCount} updated in “{specialName}”. Live within a minute while the special is running.
          <button type="button" onClick={undo} disabled={busy} className="btn btn-ghost ml-3 h-8 px-3 text-xs disabled:opacity-50">{busy ? "Undoing…" : "Undo this import"}</button>
          {done.missingPhotos.length > 0 && <p className="mt-1 text-xs text-amber-200">Still need photos: {done.missingPhotos.map((m) => m.name).join(" · ")}</p>}
        </div>
      )}
    </div>
  );
}
