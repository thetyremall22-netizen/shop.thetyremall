"use client";

import Link from "next/link";
import { TestBadge } from "./TestFlag";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";
import type { RecoverySettings } from "@/lib/cart-recovery";

// Cart Recovery admin (built by iHeart Digital).

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "—");
const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const lab = "mb-1 block text-xs font-semibold text-muted";

export const STATUS_OPTS = [
  { v: "abandoned", label: "Abandoned", badge: "badge-warn" },
  { v: "pending", label: "Unpaid", badge: "badge-warn" },
  { v: "contacted", label: "Contacted", badge: "badge-volt" },
  { v: "clicked", label: "Clicked (engaged)", badge: "badge-volt" },
  { v: "recovered", label: "Recovered", badge: "badge-pay" },
  { v: "purchased", label: "Bought (not via recovery)", badge: "badge-muted" },
  { v: "lost", label: "Lost", badge: "badge-sale" },
];
const SOURCE: Record<string, string> = { checkout: "Abandoned at checkout", pending_order: "Unpaid order", failed_order: "Failed payment", cancelled_order: "Cancelled order" };

export interface CartRow {
  id: number; email: string; firstName: string; lastName: string; phone: string; source: string; status: string;
  items: { name: string; qty: number }[]; total: number; emailsSent: number; lastEmailAt: number | null;
  orderRef: string | null; recoveredOrderRef: string | null; createdAt: number; updatedAt: number; test?: boolean;
}

function waLink(phone: string, name: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "27" + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(`Hi ${name || "there"}, it's The Tyre Mall — we saw you didn't finish your order. Can we help?`)}`;
}

export function CartsTable({ rows, canAct, canDelete }: { rows: CartRow[]; canAct: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<
    | { kind: "status"; row: CartRow; status: string }
    | { kind: "resend"; row: CartRow }
    | { kind: "delete"; row: CartRow }
    | null>(null);
  const [compose, setCompose] = useState<CartRow | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<{ id: number; status: string; message: string } | null>(null);
  const label = (v: string) => STATUS_OPTS.find((s) => s.v === v)?.label ?? v;

  async function act() {
    if (!pending) return;
    setBusy(true); setMsg(null);
    const { row } = pending;
    const res = pending.kind === "delete"
      ? await fetch(`/api/admin/cart-recovery/${row.id}`, { method: "DELETE" })
      : await fetch(`/api/admin/cart-recovery/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.kind === "resend" ? { action: "resend" } : { status: pending.status }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg({ ok: false, text: d.error ?? "Failed." });
    else {
      setMsg({ ok: true, text: pending.kind === "resend" ? `✓ Recovery email 1 sent to ${row.email}` : pending.kind === "delete" ? "✓ Deleted" : "✓ Status updated" });
      if (pending.kind === "status") setUndo({ id: row.id, status: row.status, message: `Cart #${row.id} → ${label(pending.status)}` });
    }
    setPending(null);
    router.refresh();
  }

  async function sendCompose() {
    if (!compose) return;
    setBusy(true);
    const res = await fetch(`/api/admin/cart-recovery/${compose.id}/email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: `✓ Email sent to ${compose.email}` } : { ok: false, text: d.error ?? "Couldn't send." });
    if (res.ok) { setCompose(null); router.refresh(); }
  }

  let lastEmail = "";
  return (
    <div>
      {msg && <p className={`mb-3 text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}
      {rows.length === 0 ? <p className="text-sm text-muted">No carts here yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Cart</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Items</th><th className="px-3 py-2.5 text-right">Value</th><th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Emails</th><th className="px-3 py-2.5">Last activity</th><th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sameCustomer = r.email === lastEmail;
                lastEmail = r.email;
                const badge = STATUS_OPTS.find((s) => s.v === r.status)?.badge ?? "badge-muted";
                return (
                  <tr key={r.id} className={`border-b border-line last:border-0 align-top ${sameCustomer ? "bg-surface/40" : ""}`}>
                    <td className="px-3 py-2.5"><Link href={`/admin/cart-recovery/${r.id}`} className="font-semibold text-volt hover:underline">#{r.id}</Link><TestBadge test={r.test} />
                      {r.orderRef && <div className="text-xs text-muted">{r.orderRef}</div>}</td>
                    <td className="px-3 py-2.5">
                      {sameCustomer ? <span className="text-xs text-muted">↳ same customer</span> : (
                        <>
                          <div className="font-semibold text-fg">{`${r.firstName} ${r.lastName}`.trim() || "—"}</div>
                          <div className="text-xs text-muted">{r.email}</div>
                          {r.phone && <div className="text-xs text-muted">{r.phone}</div>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">{SOURCE[r.source] ?? r.source}</td>
                    <td className="px-3 py-2.5 text-xs">{r.items.map((i, k) => <div key={k}>{i.qty}× {i.name}</div>)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{zar(r.total)}</td>
                    <td className="px-3 py-2.5">
                      {canAct ? (
                        <select value={r.status} autoComplete="off" onChange={(e) => setPending({ kind: "status", row: r, status: e.target.value })}
                          className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-fg outline-none focus:border-volt">
                          {STATUS_OPTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                        </select>
                      ) : <span className={`badge ${badge}`}>{label(r.status)}</span>}
                      {r.recoveredOrderRef && <div className="mt-1 text-xs text-muted">Order {r.recoveredOrderRef}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">{r.emailsSent}/3{r.lastEmailAt ? <div>{when(r.lastEmailAt)}</div> : null}</td>
                    <td className="px-3 py-2.5 text-xs text-muted whitespace-nowrap">{when(r.updatedAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-end gap-1 text-xs font-semibold">
                        <Link href={`/admin/cart-recovery/${r.id}`} className="text-volt hover:underline">Open →</Link>
                        {canAct && <button onClick={() => setPending({ kind: "resend", row: r })} className="text-muted hover:text-volt">Resend</button>}
                        {canAct && <button onClick={() => { setCompose(r); setSubject(`Your Tyre Mall order — can we help?`); setMessage(`Hi ${r.firstName || "there"},\n\nWe noticed you didn't finish your order on thetyremall.co.za. Can we help with anything?\n\nThe Tyre Mall team\n078 0088 788`); }} className="text-muted hover:text-volt">Email</button>}
                        {r.phone && <a href={waLink(r.phone, r.firstName)} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-volt">WhatsApp</a>}
                        {canDelete && <button onClick={() => setPending({ kind: "delete", row: r })} className="text-muted hover:text-sale">Delete</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!pending} busy={busy} onNo={() => setPending(null)} onYes={act}
        danger={pending?.kind === "delete"}
        title={pending?.kind === "delete" ? `Delete cart #${pending.row.id}?` : pending?.kind === "resend" ? `Restart the emails for ${pending.row.email}?` : "Are you sure you want to change this?"}
        yesLabel={pending?.kind === "delete" ? "Yes, delete" : pending?.kind === "resend" ? "Yes, send email 1 now" : "Yes, change it"}>
        {pending?.kind === "status" && <ChangeList changes={[{ label: `Cart #${pending.row.id}`, from: label(pending.row.status), to: label(pending.status) }]} />}
        {pending?.kind === "resend" && <p>Recovery email 1 is sent straight away; emails 2 and 3 follow on their normal schedule.</p>}
        {pending?.kind === "delete" && <p>This removes the cart record. It can&apos;t be undone (a copy stays in the history).</p>}
      </ConfirmDialog>

      {compose && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !busy && setCompose(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-ink-2 p-5 shadow-2xl">
            <h3 className="font-display text-lg">Email {compose.email}</h3>
            <p className="mt-1 text-xs text-muted">Sent from the shop mailbox in the branded layout, and logged in Admin → Emails.</p>
            <label className="mt-3 block"><span className={lab}>Subject</span><input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="mt-2 block"><span className={lab}>Message</span><textarea rows={8} className={`${field} h-auto py-2`} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-dark px-4" onClick={() => setCompose(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-volt px-5" onClick={sendCompose} disabled={busy || !subject.trim() || !message.trim()}>{busy ? "Sending…" : "Send now"}</button>
            </div>
          </div>
        </div>
      )}
      {undo && (
        <UndoBar message={undo.message} onClose={() => setUndo(null)}
          onUndo={async () => {
            await fetch(`/api/admin/cart-recovery/${undo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: undo.status, undo: true }) });
            router.refresh();
          }} />
      )}
    </div>
  );
}

export function RunNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button className="btn btn-volt h-10 px-4 text-sm" disabled={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        const r = await fetch("/api/admin/cart-recovery/run", { method: "POST" });
        const d = await r.json().catch(() => ({}));
        setBusy(false);
        setMsg(r.ok ? `✓ ${d.sent} sent${d.failed ? `, ${d.failed} failed` : ""}${d.due ? "" : " (nothing due)"}` : d.error ?? "Failed");
        router.refresh();
      }}>{busy ? "Sending…" : "Send due emails now"}</button>
      {msg && <span className="text-xs font-semibold text-muted">{msg}</span>}
    </span>
  );
}

// ---- settings ---------------------------------------------------------------

function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-volt)]" />
      <span><b className="text-fg">{label}</b>{help && <span className="block text-xs text-muted">{help}</span>}</span>
    </label>
  );
}
function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="card p-5">
      <h3 className="font-display text-lg">{title}</h3>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
const minutesLabel = (m: number) => (m === 0 ? "straight away" : m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"}` : m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} min`);

export function RecoverySettingsForm({ initial }: { initial: RecoverySettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<RecoverySettings | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const up = <K extends keyof RecoverySettings>(k: K, val: RecoverySettings[K]) => setV((x) => ({ ...x, [k]: val }));

  async function put(body: RecoverySettings) {
    const res = await fetch("/api/admin/cart-recovery/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save." }); return null; }
    return d.settings as RecoverySettings;
  }
  async function showPreview(step: number, send = false) {
    setMsg(null);
    if (dirty) { setMsg({ ok: false, text: "Save your changes first, then preview." }); return; }
    const res = await fetch("/api/admin/cart-recovery/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, send }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't build the email." }); return; }
    if (send) setMsg({ ok: true, text: `✓ Test email ${step} sent to ${d.sentTo}` });
    else setPreview(d);
  }

  return (
    <div className="space-y-5">
      <Card title="General">
        <Toggle label="Cart Recovery is on" checked={v.enabled} onChange={(x) => up("enabled", x)} help="Switch off to pause all capturing and recovery emails." />
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className={lab}>Treat a cart as abandoned after (minutes of no activity)</span>
            <input type="number" min={1} className={field} value={v.abandonMinutes} onChange={(e) => up("abandonMinutes", Number(e.target.value) || 1)} /></label>
          <label><span className={lab}>Mark “Lost” this many days after the last email (0 = never)</span>
            <input type="number" min={0} className={field} value={v.markLostAfterDays} onChange={(e) => up("markLostAfterDays", Number(e.target.value) || 0)} /></label>
          <label><span className={lab}>Delete old carts after (days, 0 = keep forever)</span>
            <input type="number" min={0} className={field} value={v.purgeAfterDays} onChange={(e) => up("purgeAfterDays", Number(e.target.value) || 0)} /></label>
        </div>
      </Card>

      <Card title="What to capture">
        <Toggle label="Checkouts not completed" checked={v.captureCheckout} onChange={(x) => up("captureCheckout", x)} help="Saved as soon as the shopper types a valid email at checkout (with their name, phone and address)." />
        <Toggle label="Unpaid orders" checked={v.capturePending} onChange={(x) => up("capturePending", x)} help="Orders that went to payment but were never paid." />
        <Toggle label="Failed payments" checked={v.captureFailed} onChange={(x) => up("captureFailed", x)} />
        <Toggle label="Cancelled orders" checked={v.captureCancelled} onChange={(x) => up("captureCancelled", x)} help="Off by default, because a cancel is often a deliberate decision." />
      </Card>

      {v.emails.map((e, i) => (
        <Card key={i} title={`Recovery email ${i + 1}`} note={i === 0 ? "Sent after the abandon window, plus this delay." : `Sent this long after email ${i}.`}>
          <Toggle label={`Send email ${i + 1}`} checked={e.enabled} onChange={(x) => up("emails", v.emails.map((y, j) => (j === i ? { ...y, enabled: x } : y)))} />
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label><span className={lab}>Delay (minutes) — {minutesLabel(e.delayMinutes)}</span>
              <input type="number" min={0} className={field} value={e.delayMinutes} onChange={(ev) => up("emails", v.emails.map((y, j) => (j === i ? { ...y, delayMinutes: Number(ev.target.value) || 0 } : y)))} /></label>
            <label><span className={lab}>Subject</span>
              <input className={field} value={e.subject} onChange={(ev) => up("emails", v.emails.map((y, j) => (j === i ? { ...y, subject: ev.target.value } : y)))} /></label>
          </div>
          <label className="block"><span className={lab}>Message</span>
            <textarea rows={3} className={`${field} h-auto py-2`} value={e.intro} onChange={(ev) => up("emails", v.emails.map((y, j) => (j === i ? { ...y, intro: ev.target.value } : y)))} /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-dark h-9 px-3 text-xs" onClick={() => showPreview(i + 1)}>Preview email {i + 1}</button>
            <button type="button" className="btn btn-dark h-9 px-3 text-xs" onClick={() => showPreview(i + 1, true)}>Send me a test</button>
          </div>
        </Card>
      ))}

      <Card title="Email look" note="Merge tags you can use in subjects and messages: {first_name}, {site_name}, {total}.">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <label><span className={lab}>Heading</span><input className={field} value={v.heading} onChange={(e) => up("heading", e.target.value)} /></label>
          <label><span className={lab}>Button / accent colour</span>
            <span className="flex gap-2"><input type="color" value={v.brandColor} onChange={(e) => up("brandColor", e.target.value)} className="h-10 w-12 rounded border border-line bg-surface-2" />
              <input className={field} value={v.brandColor} onChange={(e) => up("brandColor", e.target.value)} /></span></label>
        </div>
      </Card>

      <Card title="Discount code (optional)" note="Create the code in Admin → Coupons first, then enter it here.">
        <Toggle label="Include a discount code" checked={v.discount.enabled} onChange={(x) => up("discount", { ...v.discount, enabled: x })} />
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <label><span className={lab}>Code</span><input className={field} value={v.discount.code} onChange={(e) => up("discount", { ...v.discount, code: e.target.value.toUpperCase() })} /></label>
          <label><span className={lab}>Text ({"{code}"} = the code)</span><input className={field} value={v.discount.text} onChange={(e) => up("discount", { ...v.discount, text: e.target.value })} /></label>
        </div>
        <Toggle label="Only in the last email" checked={v.discount.finalOnly} onChange={(x) => up("discount", { ...v.discount, finalOnly: x })} />
        <Toggle label="Apply it automatically when they click “Complete my order”" checked={v.discount.autoApply} onChange={(x) => up("discount", { ...v.discount, autoApply: x })} />
      </Card>

      <Card title="Customer service block" note="Shown in every recovery email.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={lab}>WhatsApp number (international, e.g. 27780088788)</span><input className={field} value={v.support.whatsapp} onChange={(e) => up("support", { ...v.support, whatsapp: e.target.value })} /></label>
          <label><span className={lab}>WhatsApp pre-filled message</span><input className={field} value={v.support.whatsappMessage} onChange={(e) => up("support", { ...v.support, whatsappMessage: e.target.value })} /></label>
          <label><span className={lab}>Customer service email</span><input className={field} value={v.support.email} onChange={(e) => up("support", { ...v.support, email: e.target.value })} /></label>
          <label><span className={lab}>Phone</span><input className={field} value={v.support.phone} onChange={(e) => up("support", { ...v.support, phone: e.target.value })} /></label>
        </div>
      </Card>

      <Card title="Exit-intent popup (optional)" note="When a shopper with items in their cart moves to leave the page, show a gentle reminder. Shows at most once per visitor every few hours, never in the first few seconds.">
        <Toggle label="Show the exit popup" checked={v.exitPopup.enabled} onChange={(x) => up("exitPopup", { ...v.exitPopup, enabled: x })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={lab}>Title</span><input className={field} value={v.exitPopup.title} onChange={(e) => up("exitPopup", { ...v.exitPopup, title: e.target.value })} /></label>
          <label><span className={lab}>Text</span><input className={field} value={v.exitPopup.text} onChange={(e) => up("exitPopup", { ...v.exitPopup, text: e.target.value })} /></label>
          <label><span className={lab}>Button (on other pages)</span><input className={field} value={v.exitPopup.cta} onChange={(e) => up("exitPopup", { ...v.exitPopup, cta: e.target.value })} /></label>
          <label><span className={lab}>Button (on the checkout page)</span><input className={field} value={v.exitPopup.ctaStay} onChange={(e) => up("exitPopup", { ...v.exitPopup, ctaStay: e.target.value })} /></label>
          <label><span className={lab}>Show at most once every (hours, 0 = every page)</span><input type="number" min={0} className={field} value={v.exitPopup.cooldownHours} onChange={(e) => up("exitPopup", { ...v.exitPopup, cooldownHours: Number(e.target.value) || 0 })} /></label>
        </div>
      </Card>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink p-3 shadow-2xl">
        <button disabled={!dirty} onClick={() => setConfirm(true)} className="btn btn-volt px-6 disabled:opacity-50">Save settings</button>
        <button disabled={!dirty} onClick={() => { setV(saved); setMsg(null); }} className="btn btn-dark px-4 disabled:opacity-50">Discard</button>
        {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</span>}
      </div>

      <ConfirmDialog open={confirm} busy={busy} yesLabel="Yes, save settings" onNo={() => setConfirm(false)}
        onYes={async () => {
          setBusy(true); setMsg(null);
          const prev = saved;
          const r = await put(v);
          setBusy(false); setConfirm(false);
          if (r) { setSaved(r); setV(r); setUndo(prev); setMsg({ ok: true, text: "✓ Saved" }); router.refresh(); }
        }}>
        <p>The new settings apply from the next scheduled run (within 5 minutes).</p>
      </ConfirmDialog>
      {undo && <UndoBar message="Cart Recovery settings saved" onClose={() => setUndo(null)}
        onUndo={async () => { const r = await put(undo); if (r) { setSaved(r); setV(r); setMsg({ ok: true, text: "↩ Undone" }); } }} />}

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => setPreview(null)} />
          <div className="relative flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-ink-2 p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-3"><b className="truncate text-sm">Subject: {preview.subject}</b>
              <button onClick={() => setPreview(null)} className="btn btn-dark h-8 px-3 text-xs">Close</button></div>
            <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="w-full flex-1 rounded-lg bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
