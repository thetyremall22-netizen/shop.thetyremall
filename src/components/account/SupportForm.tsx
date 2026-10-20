"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { field, lab, FieldErr } from "./AuthForms";

export interface OrderOption { reference: string; date: string; total: string; status: string; summary: string }

const NEEDS_ORDER = ["cancel", "change_address", "change_items", "add_items", "delivery", "payment", "return"];
const HINT: Record<string, string> = {
  cancel: "Please tell us why you'd like to cancel. If you've already paid, we'll explain the refund once it's approved.",
  change_address: "Give the new delivery address (street, suburb, city, postal code) or the fitment change you need.",
  change_items: "Tell us which items to change and what you'd like instead (size, brand, quantity).",
  add_items: "Tell us what you'd like to add (size, brand, how many), or paste the product names. We'll confirm the price and how to pay.",
  delivery: "Tell us what you need to know about your delivery.",
  payment: "Tell us about the payment or invoice question.",
  return: "Tell us which item, what's wrong, and whether it has been fitted.",
  other: "How can we help?",
};

export function SupportForm({ topics, orders, initialOrder, initialTopic }: { topics: [string, string][]; orders: OrderOption[]; initialOrder?: string; initialTopic?: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic && topics.some(([k]) => k === initialTopic) ? initialTopic : initialOrder ? "change_address" : "");
  const [picked, setPicked] = useState<string[]>(initialOrder && orders.some((o) => o.reference === initialOrder) ? [initialOrder] : []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const needsOrder = NEEDS_ORDER.includes(topic);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setErrors({});
    const res = await fetch("/api/account/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, orders: picked, message }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setErr(d.error ?? "Couldn't send your request. Please try again."); setErrors(d.errors ?? {}); return; }
    router.push(`/account/support/${d.ref}?sent=1`);
    router.refresh();
  }


  return (
    <form onSubmit={submit} className="card space-y-5 p-5" noValidate>
      <label className="block"><span className={lab}>What do you need help with?</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
          <option value="">Choose…</option>
          {topics.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select><FieldErr msg={errors.topic} /></label>

      {topic === "cancel" && (
        <p className="rounded-lg border border-sale/40 bg-sale/10 px-3 py-2 text-sm text-fg">
          Cancellations are checked by our team before they&apos;re confirmed. Your order is <b>not</b> cancelled until we reply to confirm it.
        </p>
      )}

      <div>
        <span className={lab}>Which order{needsOrder ? "" : " (optional)"}?</span>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">You don&apos;t have any orders on this account yet.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {orders.map((o) => {
              const on = picked.includes(o.reference);
              return (
                <label key={o.reference} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${on ? "border-volt bg-volt/5" : "border-line hover:border-line-2"}`}>
                  <input type="checkbox" checked={on} onChange={(e) => setPicked(e.target.checked ? [...picked, o.reference] : picked.filter((r) => r !== o.reference))} className="mt-0.5 size-4 accent-[var(--color-volt)]" />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-fg">{o.reference}</span> <span className="text-muted">· {o.date} · {o.total} · {o.status}</span>
                    <span className="block truncate text-xs text-muted">{o.summary}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <FieldErr msg={errors.orders} />
      </div>

      <label className="block"><span className={lab}>{topic === "cancel" ? "Why would you like to cancel?" : "Your message"}</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={4000} placeholder={HINT[topic] ?? HINT.other} className={`${field} h-auto py-2`} />
        <FieldErr msg={errors.message} /></label>

      {err && <p className="text-sm font-semibold text-sale">{err}</p>}
      <button className="btn btn-volt h-11 px-6" disabled={busy}>{busy ? "Sending…" : topic === "cancel" ? "Send cancellation request" : "Send request"}</button>
      <p className="text-xs text-muted">We&apos;ll email you when we reply, usually within one working day. You can follow it under Support in your account.</p>
    </form>
  );
}

export function SupportReply({ reference, closed }: { reference: string; closed: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (closed) return <p className="card p-4 text-sm text-muted">This request is closed. If you need more help, please open a new request.</p>;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch(`/api/account/support/${encodeURIComponent(reference)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setErr(d.error ?? "Couldn't send. Please try again."); return; }
    setMessage("");
    router.refresh();
  }
  return (
    <form onSubmit={send} className="card space-y-3 p-4">
      <label className="block"><span className={lab}>Add a message</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={4000} className={`${field} h-auto py-2`} /></label>
      {err && <p className="text-sm font-semibold text-sale">{err}</p>}
      <button className="btn btn-volt h-10 px-5" disabled={busy || message.trim().length < 2}>{busy ? "Sending…" : "Send"}</button>
    </form>
  );
}
