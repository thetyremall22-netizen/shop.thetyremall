"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { v: "processing", label: "Processing" },
  { v: "completed", label: "Completed" },
  { v: "on-hold", label: "On hold" },
  { v: "cancelled", label: "Cancelled" },
  { v: "refunded", label: "Refunded" },
];

export function OrderStatusForm({ id, current }: { id: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setDone(false); setError(null);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { setDone(true); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Couldn't update."); }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={status} onChange={(e) => { setStatus(e.target.value); setDone(false); }}
        className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-fg outline-none focus:border-volt">
        {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
      </select>
      <button onClick={save} disabled={busy || status === current} className="btn btn-volt px-5 disabled:opacity-50">
        {busy ? "Updating…" : "Update status"}
      </button>
      {done && <span className="text-sm font-semibold text-pay">✓ Updated — customer emailed</span>}
      {error && <span className="text-sm font-semibold text-sale">{error}</span>}
      <p className="w-full text-xs text-muted">Cancelling or refunding also restocks the items. (Money refunds are done in your PayFast dashboard.)</p>
    </div>
  );
}
