"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ReviewRow { id: number; name: string; location: string; rating: number; quote: string; source: string; verified: boolean; featured: boolean; sortOrder: number }
export interface Summary { overall: number; count: string; sourceCopy: string }

const field = "mt-1 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const label = "text-xs font-bold uppercase tracking-wide text-muted";
const EMPTY = { id: 0, name: "", location: "", rating: 5, quote: "", source: "google", verified: true, featured: true, sortOrder: 0 };

export function ReviewsManager({ summary, reviews }: { summary: Summary; reviews: ReviewRow[] }) {
  const router = useRouter();
  // summary
  const [overall, setOverall] = useState(String(summary.overall));
  const [count, setCount] = useState(summary.count);
  const [sourceCopy, setSourceCopy] = useState(summary.sourceCopy);
  const [sumMsg, setSumMsg] = useState<string | null>(null);
  // review form
  const [f, setF] = useState<ReviewRow>({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveSummary() {
    setSumMsg(null);
    const res = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overall: Number(overall), count, sourceCopy }) });
    setSumMsg(res.ok ? "✓ Saved — live on the homepage" : "Couldn't save.");
    if (res.ok) router.refresh();
  }

  function resetForm() { setF({ ...EMPTY }); setEditingId(null); setMsg(null); }
  function edit(r: ReviewRow) { setEditingId(r.id); setF({ ...r }); setMsg(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function saveReview() {
    if (busy) return;
    setBusy(true); setMsg(null);
    const body = { name: f.name, location: f.location, rating: f.rating, quote: f.quote, source: f.source, verified: f.verified, featured: f.featured, sortOrder: f.sortOrder };
    const res = await fetch(editingId ? `/api/admin/reviews/${editingId}` : "/api/admin/reviews", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(editingId ? "✓ Updated" : "✓ Added"); resetForm(); router.refresh(); }
    else setMsg(d.error ?? "Couldn't save.");
    setBusy(false);
  }

  async function toggleFeatured(r: ReviewRow) {
    await fetch(`/api/admin/reviews/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featured: !r.featured }) });
    router.refresh();
  }
  async function remove(r: ReviewRow) {
    if (!confirm(`Delete the review from ${r.name}?`)) return;
    await fetch(`/api/admin/reviews/${r.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">Rating summary (the big 4.8★ block)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className={label}>Overall (0–5)</span><input type="number" min={0} max={5} step="0.1" value={overall} onChange={(e) => setOverall(e.target.value)} className={field} /></label>
          <label className="block"><span className={label}>Count label</span><input value={count} onChange={(e) => setCount(e.target.value)} placeholder="1,200+" className={field} /></label>
          <label className="block"><span className={label}>Source copy</span><input value={sourceCopy} onChange={(e) => setSourceCopy(e.target.value)} className={field} /></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveSummary} className="btn btn-volt px-5">Save summary</button>
          {sumMsg && <span className={`text-sm font-semibold ${sumMsg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{sumMsg}</span>}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display text-lg">{editingId ? "Edit testimonial" : "Add testimonial"}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={label}>Customer name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={field} /></label>
          <label className="block"><span className={label}>Location (optional)</span><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Johannesburg" className={field} /></label>
          <label className="block sm:col-span-2"><span className={label}>Quote</span><textarea value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} rows={2} className={`${field} h-auto py-2`} /></label>
          <label className="block"><span className={label}>Rating</span>
            <select value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })} className={field}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>)}</select></label>
          <label className="block"><span className={label}>Source</span>
            <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={field}><option value="google">Google</option><option value="onsite">On-site</option></select></label>
          <label className="flex items-center gap-2.5 pt-6"><input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} className="size-4 accent-volt" /><span className="text-sm font-semibold text-fg">Show on homepage</span></label>
          <label className="flex items-center gap-2.5 pt-6"><input type="checkbox" checked={f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked })} className="size-4 accent-volt" /><span className="text-sm font-semibold text-fg">Verified</span></label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveReview} disabled={busy || !f.name || !f.quote} className="btn btn-volt px-5 disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Add testimonial"}</button>
          {editingId && <button onClick={resetForm} className="text-sm font-semibold text-muted hover:text-fg">Cancel</button>}
          {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Quote</th><th className="px-4 py-2.5">Rating</th><th className="px-4 py-2.5">On homepage</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {reviews.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">No reviews yet.</td></tr>}
            {reviews.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-3"><div className="font-semibold text-fg">{r.name}</div><div className="text-xs text-muted">{r.location || r.source}</div></td>
                <td className="px-4 py-3 max-w-[320px] text-muted">“{r.quote.length > 90 ? r.quote.slice(0, 90) + "…" : r.quote}”</td>
                <td className="px-4 py-3 whitespace-nowrap text-amber-400">{"★".repeat(r.rating)}</td>
                <td className="px-4 py-3">{r.featured ? <span className="badge badge-pay">shown</span> : <span className="badge badge-muted">hidden</span>}</td>
                <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-3">
                  <button onClick={() => edit(r)} className="text-xs font-semibold text-volt hover:underline">Edit</button>
                  <button onClick={() => toggleFeatured(r)} className="text-xs font-semibold text-muted hover:text-fg">{r.featured ? "Hide" : "Show"}</button>
                  <button onClick={() => remove(r)} className="text-xs font-semibold text-muted hover:text-sale">Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
