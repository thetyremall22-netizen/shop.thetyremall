"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefundForm({ id, maxRefundCents, paymentMethod }: { id: string; maxRefundCents: number; paymentMethod: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState((maxRefundCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    const cents = Math.round(Number(amount) * 100);
    if (!confirming) { if (!(cents > 0)) { setMsg("Enter an amount."); return; } setConfirming(true); setMsg(null); return; }
    setConfirming(false); setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}/refund`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: cents, reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(d.manual
          ? `✓ Recorded a ${d.status === "refunded" ? "full" : "partial"} refund. Now release the money in your PayFast dashboard.`
          : `✓ Refund processed via the gateway (${d.status === "refunded" ? "full" : "partial"}).`);
        router.refresh();
      } else setMsg(d.error ?? "Refund failed.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  const auto = paymentMethod === "happypay";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Amount (R)</span>
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setConfirming(false); }} className="mt-1 h-10 w-32 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Reason (optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer returned goods" className="mt-1 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <button onClick={submit} disabled={busy} className="btn btn-volt px-5 disabled:opacity-50">{busy ? "Processing…" : `Confirm refund of R${amount}`}</button>
            <button onClick={() => setConfirming(false)} className="text-sm font-semibold text-muted hover:text-fg">Cancel</button>
          </>
        ) : (
          <button onClick={submit} disabled={busy} className="btn btn-dark px-5 disabled:opacity-50">Refund</button>
        )}
        {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
      </div>
      <p className="text-xs text-muted">
        {auto
          ? "HappyPay refunds are processed automatically through their API."
          : "PayFast has no refund API — this records the refund, restocks (on a full refund) and emails the customer; release the money from your PayFast dashboard."}
        {" "}A full refund restocks the items.
      </p>
    </div>
  );
}
