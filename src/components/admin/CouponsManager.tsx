"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CouponRow {
  id: number; code: string; description: string;
  discountType: "percentage" | "fixed"; discountValue: number;
  scope: "all" | "products"; productSlugs: string[];
  minSpend: number; perCustomerLimit: number; usageLimitTotal: number;
  active: boolean; startsAt: number | null; endsAt: number | null; timesUsed: number;
}

const field = "mt-1 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const label = "text-xs font-bold uppercase tracking-wide text-muted";
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
const toLocal = (ms: number | null) => (ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (s: string) => (s ? new Date(s).getTime() : null);

interface FormState {
  id: number; code: string; description: string;
  discountType: "percentage" | "fixed"; discountValue: number;
  scope: "all" | "products"; productSlugs: string[];
  minSpend: number; perCustomerLimit: number; usageLimitTotal: number;
  active: boolean; startsAt: number | null; endsAt: number | null;
}
const EMPTY: FormState = { id: 0, code: "", description: "", discountType: "percentage", discountValue: 10, scope: "all", productSlugs: [], minSpend: 0, perCustomerLimit: 0, usageLimitTotal: 0, active: true, startsAt: null, endsAt: null };

export function CouponsManager({ coupons }: { coupons: CouponRow[] }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [slugText, setSlugText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function reset() { setF({ ...EMPTY }); setEditingId(null); setSlugText(""); setMsg(null); }
  function edit(c: CouponRow) {
    setEditingId(c.id);
    setF({ id: c.id, code: c.code, description: c.description, discountType: c.discountType, discountValue: c.discountType === "fixed" ? c.discountValue / 100 : c.discountValue, scope: c.scope, productSlugs: c.productSlugs, minSpend: c.minSpend / 100, perCustomerLimit: c.perCustomerLimit, usageLimitTotal: c.usageLimitTotal, active: c.active, startsAt: c.startsAt, endsAt: c.endsAt });
    setSlugText(c.productSlugs.join("\n"));
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (busy) return;
    setBusy(true); setMsg(null);
    const body = {
      code: f.code, description: f.description, discountType: f.discountType,
      discountValue: f.discountType === "fixed" ? Math.round(Number(f.discountValue) * 100) : Number(f.discountValue),
      scope: f.scope,
      productSlugs: f.scope === "products" ? slugText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : [],
      minSpend: Math.round(Number(f.minSpend) * 100), perCustomerLimit: Number(f.perCustomerLimit), usageLimitTotal: Number(f.usageLimitTotal),
      active: f.active, startsAt: f.startsAt, endsAt: f.endsAt,
    };
    try {
      const res = await fetch(editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setMsg(editingId ? "✓ Coupon updated" : "✓ Coupon created"); reset(); router.refresh(); }
      else setMsg(d.error ?? "Couldn't save coupon.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  async function toggle(c: CouponRow) {
    await fetch(`/api/admin/coupons/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, discountValue: c.discountType === "fixed" ? c.discountValue : c.discountValue, active: !c.active }) });
    router.refresh();
  }
  async function remove(c: CouponRow) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">{editingId ? `Edit coupon ${f.code}` : "Create a coupon"}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={label}>Code (what customers type)</span>
            <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WINTER10" className={field} /></label>
          <label className="block"><span className={label}>Description (internal)</span>
            <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={field} /></label>

          <label className="block"><span className={label}>Discount type</span>
            <select value={f.discountType} onChange={(e) => setF({ ...f, discountType: e.target.value as "percentage" })} className={field}>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed amount (R)</option>
            </select></label>
          <label className="block"><span className={label}>{f.discountType === "percentage" ? "Percent off (%)" : "Amount off (R)"}</span>
            <input type="number" min={0} step={f.discountType === "percentage" ? 1 : 0.01} value={f.discountValue} onChange={(e) => setF({ ...f, discountValue: Number(e.target.value) })} className={field} /></label>

          <label className="block"><span className={label}>Applies to</span>
            <select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as "all" })} className={field}>
              <option value="all">All products</option>
              <option value="products">Specific products</option>
            </select></label>
          <label className="block"><span className={label}>Minimum spend (R, 0 = none)</span>
            <input type="number" min={0} step="0.01" value={f.minSpend} onChange={(e) => setF({ ...f, minSpend: Number(e.target.value) })} className={field} /></label>

          {f.scope === "products" && (
            <label className="block sm:col-span-2"><span className={label}>Product slugs or SKUs (one per line or comma-separated)</span>
              <textarea value={slugText} onChange={(e) => setSlugText(e.target.value)} rows={3} placeholder="radar-245-70hr16-renegade-at5-2&#10;anchee-165-80r13-83t-ac808" className={`${field} h-auto py-2 font-mono text-xs`} /></label>
          )}

          <label className="block"><span className={label}>Uses per customer</span>
            <select value={f.perCustomerLimit} onChange={(e) => setF({ ...f, perCustomerLimit: Number(e.target.value) })} className={field}>
              <option value={0}>No limit per customer</option>
              <option value={1}>1 per customer</option>
            </select></label>
          <label className="block"><span className={label}>Total uses (0 = unlimited)</span>
            <input type="number" min={0} value={f.usageLimitTotal} onChange={(e) => setF({ ...f, usageLimitTotal: Number(e.target.value) })} className={field} /></label>

          <label className="block"><span className={label}>Starts (optional)</span>
            <input type="datetime-local" value={toLocal(f.startsAt)} onChange={(e) => setF({ ...f, startsAt: fromLocal(e.target.value) })} className={field} /></label>
          <label className="block"><span className={label}>Ends (optional)</span>
            <input type="datetime-local" value={toLocal(f.endsAt)} onChange={(e) => setF({ ...f, endsAt: fromLocal(e.target.value) })} className={field} /></label>

          <label className="flex items-center gap-2.5 pt-6">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="size-4 accent-volt" />
            <span className="text-sm font-semibold text-fg">Active</span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy || !f.code} className="btn btn-volt px-5 disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Create coupon"}</button>
          {editingId && <button onClick={reset} className="text-sm font-semibold text-muted hover:text-fg">Cancel edit</button>}
          {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
        </div>
        <p className="mt-2 text-xs text-muted">1 coupon per order. &quot;1 per customer&quot; is enforced by email once the order is paid. &quot;Fixed amount&quot; and the discount are capped at the value of the eligible items.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Discount</th><th className="px-4 py-2.5">Applies to</th><th className="px-4 py-2.5">Limits</th><th className="px-4 py-2.5">Used</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">No coupons yet — create your first above.</td></tr>}
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold text-fg">{c.code}{c.description && <div className="text-xs font-normal text-muted">{c.description}</div>}</td>
                <td className="px-4 py-3">{c.discountType === "percentage" ? `${c.discountValue}% off` : `${zar(c.discountValue)} off`}{c.minSpend > 0 && <div className="text-xs text-muted">min {zar(c.minSpend)}</div>}</td>
                <td className="px-4 py-3 text-muted">{c.scope === "all" ? "All products" : `${c.productSlugs.length} product(s)`}</td>
                <td className="px-4 py-3 text-xs text-muted">{c.perCustomerLimit === 1 ? "1/customer" : "no per-customer limit"}{c.usageLimitTotal > 0 ? ` · ${c.usageLimitTotal} total` : ""}</td>
                <td className="px-4 py-3 text-muted">{c.timesUsed}</td>
                <td className="px-4 py-3">{c.active ? <span className="badge badge-pay">active</span> : <span className="badge badge-muted">off</span>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => edit(c)} className="text-xs font-semibold text-volt hover:underline">Edit</button>
                    <button onClick={() => toggle(c)} className="text-xs font-semibold text-muted hover:text-fg">{c.active ? "Turn off" : "Turn on"}</button>
                    <button onClick={() => remove(c)} className="text-xs font-semibold text-muted hover:text-sale">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
