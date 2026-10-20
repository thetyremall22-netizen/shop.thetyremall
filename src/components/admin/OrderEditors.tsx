"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";

// ---- shared -----------------------------------------------------------------

type Json = Record<string, unknown>;
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const labelCls = "mb-1 block text-xs font-semibold text-muted";

async function patchOrder(id: string, body: Json): Promise<{ ok: boolean; data: Json }> {
  const res = await fetch(`/api/admin/orders/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, data };
}

/** Edit → confirm → save → undo, for one section of an order. */
function useOrderSection(id: string) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ body: Json; message: string } | null>(null);

  async function save(body: Json, undoBody: Json, message: string): Promise<boolean> {
    setBusy(true); setError(null);
    const r = await patchOrder(id, body);
    setBusy(false); setConfirm(false);
    if (!r.ok) { setError(String(r.data.error ?? "Couldn't save.")); return false; }
    setUndo({ body: { ...undoBody, undo: true }, message });
    router.refresh();
    return true;
  }
  const doUndo = useCallback(async () => {
    if (!undo) return;
    const r = await patchOrder(id, undo.body);
    if (!r.ok) setError(String(r.data.error ?? "Couldn't undo."));
    router.refresh();
  }, [id, undo, router]);

  const undoBar = undo ? <UndoBar message={undo.message} onUndo={doUndo} onClose={() => setUndo(null)} /> : null;
  return { confirm, setConfirm, busy, error, setError, save, undoBar };
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className="btn btn-volt-outline h-9 px-4 text-xs">✏️ {label}</button>;
}

// ---- customer + delivery ------------------------------------------------------

interface Customer { firstName: string; lastName: string; email: string; phone: string }
interface Address { street: string; suburb: string; city: string; province: string; postalCode: string }
interface Delivery { method: "delivery" | "fitment"; address?: Address; fitmentStore?: string; fitmentDate?: string }

const emptyAddr: Address = { street: "", suburb: "", city: "", province: "", postalCode: "" };

export function OrderCustomerEditor({ id, customer, delivery, canEdit }: { id: string; customer: Customer; delivery: Delivery; canEdit: boolean }) {
  const sec = useOrderSection(id);
  const [editing, setEditing] = useState(false);
  const [c, setC] = useState<Customer>(customer);
  const [d, setD] = useState<Delivery>({ ...delivery, address: delivery.address ?? emptyAddr });
  useEffect(() => { if (!editing) { setC(customer); setD({ ...delivery, address: delivery.address ?? emptyAddr }); } }, [customer, delivery, editing]);

  const rows: [string, string, string][] = [
    ["First name", customer.firstName, c.firstName], ["Last name", customer.lastName, c.lastName],
    ["Email", customer.email, c.email], ["Phone", customer.phone, c.phone],
    ["Method", delivery.method, d.method],
    ...(d.method === "fitment"
      ? ([["Fitment centre", delivery.fitmentStore ?? "", d.fitmentStore ?? ""], ["Fitment date", delivery.fitmentDate ?? "", d.fitmentDate ?? ""]] as [string, string, string][])
      : ([
          ["Street", delivery.address?.street ?? "", d.address?.street ?? ""], ["Suburb", delivery.address?.suburb ?? "", d.address?.suburb ?? ""],
          ["City", delivery.address?.city ?? "", d.address?.city ?? ""], ["Province", delivery.address?.province ?? "", d.address?.province ?? ""],
          ["Postal code", delivery.address?.postalCode ?? "", d.address?.postalCode ?? ""],
        ] as [string, string, string][])),
  ];
  const changes = rows.filter(([, a, b]) => a.trim() !== b.trim()).map(([label, from, to]) => ({ label, from, to }));
  const a = delivery.address;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Customer &amp; delivery</h2>
        {canEdit && !editing && <EditButton label="Edit" onClick={() => { setEditing(true); sec.setError(null); }} />}
      </div>
      {!editing ? (
        <div className="mt-2 text-sm">
          <div className="font-semibold text-fg">{customer.firstName} {customer.lastName}</div>
          <a href={`mailto:${customer.email}`} className="block text-volt hover:underline">{customer.email}</a>
          {customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="block text-volt hover:underline">{customer.phone}</a>}
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{delivery.method === "fitment" ? "Fitment" : "Delivery address"}</h3>
          <div className="mt-1 text-fg">
            {delivery.method === "fitment"
              ? <>{delivery.fitmentStore ?? "Partner centre"}{delivery.fitmentDate ? ` · ${delivery.fitmentDate}` : ""}</>
              : a ? <>{a.street}<br />{a.suburb}<br />{a.city}, {a.province} {a.postalCode}</> : "—"}
          </div>
        </div>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (changes.length) sec.setConfirm(true); }}>
          <div className="grid grid-cols-2 gap-2">
            <label><span className={labelCls}>First name</span><input className={field} value={c.firstName} onChange={(e) => setC({ ...c, firstName: e.target.value })} /></label>
            <label><span className={labelCls}>Last name</span><input className={field} value={c.lastName} onChange={(e) => setC({ ...c, lastName: e.target.value })} /></label>
          </div>
          <label className="block"><span className={labelCls}>Email</span><input type="email" className={field} value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></label>
          <label className="block"><span className={labelCls}>Phone</span><input type="tel" className={field} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></label>
          <label className="block"><span className={labelCls}>Delivery method</span>
            <select className={field} value={d.method} onChange={(e) => setD({ ...d, method: e.target.value as Delivery["method"] })}>
              <option value="delivery">Delivery to address</option>
              <option value="fitment">Fitment at partner centre</option>
            </select>
          </label>
          {d.method === "fitment" ? (
            <>
              <label className="block"><span className={labelCls}>Fitment centre</span><input className={field} value={d.fitmentStore ?? ""} onChange={(e) => setD({ ...d, fitmentStore: e.target.value })} /></label>
              <label className="block"><span className={labelCls}>Fitment date</span><input className={field} value={d.fitmentDate ?? ""} onChange={(e) => setD({ ...d, fitmentDate: e.target.value })} /></label>
            </>
          ) : (
            <>
              {(["street", "suburb", "city", "province", "postalCode"] as const).map((k) => (
                <label key={k} className="block"><span className={labelCls}>{{ street: "Street", suburb: "Suburb", city: "City", province: "Province", postalCode: "Postal code" }[k]}</span>
                  <input className={field} value={d.address?.[k] ?? ""} onChange={(e) => setD({ ...d, address: { ...(d.address ?? emptyAddr), [k]: e.target.value } })} /></label>
              ))}
            </>
          )}
          {sec.error && <p className="text-sm font-semibold text-sale">{sec.error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-dark flex-1" onClick={() => { setEditing(false); sec.setError(null); }}>Cancel</button>
            <button type="submit" className="btn btn-volt flex-1 disabled:opacity-50" disabled={!changes.length}>Save changes</button>
          </div>
        </form>
      )}
      <ConfirmDialog open={sec.confirm} busy={sec.busy} yesLabel="Yes, change it" onNo={() => sec.setConfirm(false)}
        onYes={async () => { if (await sec.save({ customer: c, delivery: d }, { customer, delivery }, "Customer details updated")) setEditing(false); }}>
        <ChangeList changes={changes} />
      </ConfirmDialog>
      {sec.undoBar}
    </div>
  );
}

// ---- items + totals -----------------------------------------------------------

interface Item { slug: string; name: string; sku?: string; qty: number; price: number; type?: string; alignment?: boolean; balanceQty?: number; roadHazard?: boolean }
interface Totals { subtotal: number; setDiscount: number; alignmentTotal: number; balanceTotal: number; hazardTotal: number; couponDiscount: number; couponCode?: string; delivery: number; total: number }
interface SearchHit { name: string; slug: string; price: number; size?: string; brand?: string }

const TOTAL_FIELDS: { k: keyof Totals; label: string; minus?: boolean }[] = [
  { k: "setDiscount", label: "Set of 4 saving", minus: true },
  { k: "alignmentTotal", label: "Wheel alignment" },
  { k: "balanceTotal", label: "Balance & valve" },
  { k: "hazardTotal", label: "Road hazard cover" },
  { k: "couponDiscount", label: "Coupon discount", minus: true },
  { k: "delivery", label: "Delivery" },
];
const randsToCents = (v: string) => Math.max(0, Math.round((parseFloat(v.replace(",", ".")) || 0) * 100));
const centsToRands = (c: number) => (c / 100).toFixed(2);

export function OrderItemsEditor({ id, items, totals, canEdit }: { id: string; items: Item[]; totals: Totals; canEdit: boolean }) {
  const sec = useOrderSection(id);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState(items.map((i) => ({ ...i, priceR: centsToRands(i.price) })));
  const [tot, setTot] = useState<Record<string, string>>(Object.fromEntries(TOTAL_FIELDS.map((f) => [f.k, centsToRands(totals[f.k] as number)])));
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!editing) {
      setRows(items.map((i) => ({ ...i, priceR: centsToRands(i.price) })));
      setTot(Object.fromEntries(TOTAL_FIELDS.map((f) => [f.k, centsToRands(totals[f.k] as number)])));
    }
  }, [items, totals, editing]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((r) => r.json())
        .then((d) => setHits(((d.results ?? []) as SearchHit[]).slice(0, 8))).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const live = rows.filter((r) => r.qty > 0);
  const subtotal = live.reduce((n, r) => n + randsToCents(r.priceR) * r.qty, 0);
  const tc = (k: keyof Totals) => randsToCents(tot[k] ?? "0");
  const newTotal = Math.max(0, subtotal - tc("setDiscount") + tc("alignmentTotal") + tc("balanceTotal") + tc("hazardTotal") - tc("couponDiscount") + tc("delivery"));

  const line = (i: Item) => `${i.qty}× ${i.name} @ ${zar(i.price)}`;
  const changes: { label: string; from: string; to: string }[] = [];
  const before = new Map(items.map((i) => [i.slug, i]));
  for (const r of rows) {
    const b = before.get(r.slug);
    const now = { ...r, price: randsToCents(r.priceR) };
    if (!b) { if (r.qty > 0) changes.push({ label: "Added", from: "", to: line(now) }); continue; }
    if (r.qty === 0) changes.push({ label: "Removed", from: line(b), to: "" });
    else if (b.qty !== now.qty || b.price !== now.price || (b.sku ?? "") !== (now.sku ?? "") || b.name !== now.name) changes.push({ label: b.name, from: line(b), to: line(now) });
  }
  for (const f of TOTAL_FIELDS) if ((totals[f.k] as number) !== tc(f.k)) changes.push({ label: f.label, from: zar(totals[f.k] as number), to: zar(tc(f.k)) });
  if (changes.length) changes.push({ label: "Order total", from: zar(totals.total), to: zar(newTotal) });

  const body = {
    items: live.map((r) => ({ slug: r.slug, name: r.name, sku: r.sku ?? "", qty: r.qty, price: randsToCents(r.priceR), type: r.type })),
    totals: Object.fromEntries(TOTAL_FIELDS.map((f) => [f.k, tc(f.k)])),
  };
  const undoBody = {
    items: items.map((i) => ({ slug: i.slug, name: i.name, sku: i.sku ?? "", qty: i.qty, price: i.price, type: i.type })),
    totals: Object.fromEntries(TOTAL_FIELDS.map((f) => [f.k, totals[f.k]])),
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Items</h2>
        {canEdit && !editing && <EditButton label="Edit items & prices" onClick={() => { setEditing(true); sec.setError(null); }} />}
      </div>

      {!editing ? (
        <>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-1.5">Item</th><th className="py-1.5">Part no.</th><th className="py-1.5 text-center">Qty</th><th className="py-1.5 text-right">Unit</th><th className="py-1.5 text-right">Amount</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.slug} className="border-b border-line last:border-0 align-top">
                  <td className="py-2 pr-2">{i.name}
                    {(i.alignment || (i.balanceQty ?? 0) > 0 || i.roadHazard) && (
                      <div className="text-xs text-muted">{i.alignment ? "alignment " : ""}{(i.balanceQty ?? 0) > 0 ? `balance×${i.balanceQty} ` : ""}{i.roadHazard ? "road-hazard" : ""}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-muted">{i.sku || "—"}</td>
                  <td className="py-2 text-center">{i.qty}</td>
                  <td className="py-2 text-right whitespace-nowrap">{zar(i.price)}</td>
                  <td className="py-2 text-right whitespace-nowrap">{zar(i.price * i.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{zar(totals.subtotal)}</dd></div>
            {TOTAL_FIELDS.filter((f) => (totals[f.k] as number) > 0 || f.k === "delivery").map((f) => (
              <div key={f.k} className="flex justify-between"><dt className="text-muted">{f.label}{f.k === "couponDiscount" && totals.couponCode ? ` (${totals.couponCode})` : ""}</dt>
                <dd>{f.k === "delivery" && totals.delivery === 0 ? "FREE" : `${f.minus ? "−" : ""}${zar(totals[f.k] as number)}`}</dd></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Total</dt><dd>{zar(totals.total)}</dd></div>
          </dl>
        </>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (changes.length) sec.setConfirm(true); }}>
          <div className="space-y-2">
            {rows.map((r, idx) => (
              <div key={r.slug} className={`rounded-lg border border-line p-3 ${r.qty === 0 ? "opacity-50" : ""}`}>
                <input className={field} value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))} aria-label="Item name" />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label><span className={labelCls}>Part no. / SKU</span><input className={field} value={r.sku ?? ""} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, sku: e.target.value } : x)))} /></label>
                  <label><span className={labelCls}>Qty (0 = remove)</span><input type="number" min={0} max={99} className={field} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, qty: Math.max(0, Math.min(99, Number(e.target.value) || 0)) } : x)))} /></label>
                  <label><span className={labelCls}>Unit price (R)</span><input inputMode="decimal" className={field} value={r.priceR} onChange={(e) => setRows(rows.map((x, j) => (j === idx ? { ...x, priceR: e.target.value } : x)))} /></label>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-dashed border-line p-3">
            <span className={labelCls}>Add a product</span>
            <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or size, e.g. 265/65R17" />
            {hits.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
                {hits.map((h) => (
                  <li key={h.slug}>
                    <button type="button" className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface"
                      onClick={() => {
                        if (!rows.some((r) => r.slug === h.slug)) setRows([...rows, { slug: h.slug, name: h.name, qty: 1, price: h.price, priceR: centsToRands(h.price) }]);
                        setQ(""); setHits([]);
                      }}>
                      <span className="text-fg">{h.name}</span><span className="whitespace-nowrap text-muted">{zar(h.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TOTAL_FIELDS.map((f) => (
              <label key={f.k}><span className={labelCls}>{f.label} (R)</span>
                <input inputMode="decimal" className={field} value={tot[f.k] ?? ""} onChange={(e) => setTot({ ...tot, [f.k]: e.target.value })} /></label>
            ))}
          </div>
          <div className="flex justify-between rounded-lg bg-surface px-3 py-2 text-sm font-bold"><span>New total</span><span>{zar(newTotal)}</span></div>
          <p className="text-xs text-muted">Changing items or prices doesn&apos;t charge or refund the customer. Use Refund below for money back. Stock is adjusted automatically for paid orders.</p>
          {sec.error && <p className="text-sm font-semibold text-sale">{sec.error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-dark flex-1" onClick={() => { setEditing(false); sec.setError(null); }}>Cancel</button>
            <button type="submit" className="btn btn-volt flex-1 disabled:opacity-50" disabled={!changes.length}>Save changes</button>
          </div>
        </form>
      )}
      <ConfirmDialog open={sec.confirm} busy={sec.busy} yesLabel="Yes, change it" onNo={() => sec.setConfirm(false)}
        onYes={async () => { if (await sec.save(body, undoBody, "Items updated")) setEditing(false); }}>
        <ChangeList changes={changes} />
      </ConfirmDialog>
      {sec.undoBar}
    </div>
  );
}

// ---- status -----------------------------------------------------------------

export const ORDER_STATUSES = [
  { v: "pending", label: "Pending payment" },
  { v: "processing", label: "Processing" },
  { v: "on-hold", label: "On hold" },
  { v: "completed", label: "Completed" },
  { v: "cancelled", label: "Cancelled" },
  { v: "refunded", label: "Refunded" },
  { v: "failed", label: "Failed" },
];
const statusLabel = (v: string) => ORDER_STATUSES.find((s) => s.v === v)?.label ?? (v === "partially_refunded" ? "Partially refunded" : v);

export function OrderStatusEditor({ id, current, canEdit }: { id: string; current: string; canEdit: boolean }) {
  const sec = useOrderSection(id);
  const [status, setStatus] = useState(current);
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  useEffect(() => setStatus(current), [current]);
  if (!canEdit) return <p className="text-sm text-muted">Current status: <b className="text-fg">{statusLabel(current)}</b></p>;
  const restock = ["processing", "completed"].includes(current) && !["processing", "completed"].includes(status);
  const takesStock = !["processing", "completed"].includes(current) && ["processing", "completed"].includes(status);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold text-fg outline-none focus:border-volt">
          {current === "partially_refunded" && <option value="partially_refunded">Partially refunded</option>}
          {ORDER_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-[var(--color-volt)]" />
          Email the customer about this change
        </label>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / note for the history (optional, staff only)" className={field} />
      <button type="button" disabled={status === current} onClick={() => sec.setConfirm(true)} className="btn btn-volt px-5 disabled:opacity-50">Update status</button>
      {sec.error && <p className="text-sm font-semibold text-sale">{sec.error}</p>}
      <p className="text-xs text-muted">Cancelling, refunding or failing a paid order puts its items back in stock; moving it back to Processing or Completed takes them out again. Money refunds are done in the Refund section or your payment dashboard.</p>
      <ConfirmDialog open={sec.confirm} busy={sec.busy} yesLabel="Yes, change status" onNo={() => sec.setConfirm(false)}
        onYes={() => { void sec.save({ status, notify, note }, { status: current, notify: false }, `Status changed to ${statusLabel(status)}`).then((ok) => ok && setNote("")); }}>
        <ChangeList changes={[{ label: "Status", from: statusLabel(current), to: statusLabel(status) }]} />
        <p className="mt-2">{notify && status !== "pending" ? "The customer will be emailed about this change." : "The customer will NOT be emailed."}</p>
        {restock && <p className="mt-1">The items will be put back in stock.</p>}
        {takesStock && <p className="mt-1">The items will be taken out of stock.</p>}
      </ConfirmDialog>
      {sec.undoBar}
    </div>
  );
}

// ---- email actions + notes -----------------------------------------------------

const EMAIL_ACTIONS = [
  { kind: "invoice", label: "📄 Email tax invoice", confirm: "Email the tax invoice to the customer?" },
  { kind: "confirmation", label: "✉️ Resend order confirmation", confirm: "Resend the order confirmation to the customer?" },
  { kind: "status", label: "🔁 Resend current status email", confirm: "Resend the email for the order's current status to the customer?" },
  { kind: "shop", label: "🏪 Email order details to the shop", confirm: "Email the full order details (customer, address, part numbers) to the shop?" },
] as const;

export function OrderEmailActions({ id, customerEmail, canSend }: { id: string; customerEmail: string; canSend: boolean }) {
  const router = useRouter();
  const [ask, setAsk] = useState<(typeof EMAIL_ACTIONS)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!canSend) return null;
  async function send() {
    if (!ask) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/orders/${id}/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: ask.kind }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: `✓ Sent — ${ask.label.replace(/^\S+\s/, "")}` } : { ok: false, text: d.error ?? "Couldn't send." });
    setAsk(null);
    router.refresh();
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {EMAIL_ACTIONS.map((a) => (
          <button key={a.kind} type="button" onClick={() => { setAsk(a); setMsg(null); }} className="btn btn-dark h-9 px-3 text-xs">{a.label}</button>
        ))}
      </div>
      {msg && <p className={`mt-2 text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}
      <ConfirmDialog open={!!ask} busy={busy} title={ask?.confirm ?? ""} yesLabel="Yes, send" onYes={send} onNo={() => setAsk(null)}>
        {ask?.kind !== "shop" && <p>It goes to <b className="text-fg">{customerEmail}</b> and is recorded in this order&apos;s email log and history.</p>}
      </ConfirmDialog>
    </div>
  );
}

export function OrderNoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/orders/${id}/note`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Couldn't add the note."); return; }
    setText("");
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Add an internal note, e.g. “Customer called, fitment moved to Friday” (staff only)"
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-volt" />
      {error && <p className="text-sm font-semibold text-sale">{error}</p>}
      <button type="button" onClick={add} disabled={busy || !text.trim()} className="btn btn-volt h-9 px-4 text-xs disabled:opacity-50">{busy ? "Adding…" : "Add note"}</button>
    </div>
  );
}
