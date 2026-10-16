"use client";

import { useState } from "react";
import { whatsappHref, SHOP_EMAIL, SHOP_PHONE_DISPLAY } from "@/lib/shop-config";
import { Close, WhatsApp, Check } from "./icons";

type Tab = "quote" | "chat";
const VEHICLE_TYPES = ["Car / Hatch / Sedan", "SUV", "Bakkie / 4x4", "Commercial / LDV", "Truck / Bus", "Motorbike", "Other"];

export function WhatsAppPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("quote");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(true); // POPIA — pre-ticked
  const [f, setF] = useState({ name: "", email: "", phone: "", vehicle: VEHICLE_TYPES[0], tyreSize: "", rimSize: "", message: "" });

  if (!open) return null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setErr(null);
    setF((s) => ({ ...s, [k]: e.target.value }));
  };

  function buildMessage() {
    return [
      "Quote request via website:",
      f.name && `Name: ${f.name}`,
      f.vehicle && `Vehicle: ${f.vehicle}`,
      f.tyreSize && `Tyre size: ${f.tyreSize}`,
      f.rimSize && `Rim / wheel: ${f.rimSize}`,
      f.message && `Notes: ${f.message}`,
      `Consent to contact (POPIA): ${consent ? "Yes" : "No"}`,
    ].filter(Boolean).join("\n");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Native `required` covers name/email/phone; enforce at-least-one size here
    // (a tyre buyer has no rim size and vice-versa, so we can't demand both).
    if (!f.tyreSize.trim() && !f.rimSize.trim()) {
      setErr("Please fill in your tyre size or your rim / wheel size.");
      return;
    }
    setBusy(true);
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "whatsapp-quote", name: f.name, email: f.email, phone: f.phone, message: buildMessage(), contactConsent: consent }),
        keepalive: true,
      });
      setSent(true);
    } catch {
      setSent(true); // optimistic — the request is best-effort
    }
    setBusy(false);
  }

  const waText = [
    "Hi The Tyre Mall! I'd like a quote.",
    f.name && `Name: ${f.name}`,
    f.vehicle && `Vehicle: ${f.vehicle}`,
    f.tyreSize && `Tyre size: ${f.tyreSize}`,
    f.rimSize && `Rim / wheel: ${f.rimSize}`,
    f.message && `Notes: ${f.message}`,
  ].filter(Boolean).join("\n");

  return (
    <div className="fixed bottom-5 left-5 z-50 flex h-[560px] max-h-[82vh] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-2xl shadow-black/60">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line bg-ink px-4 py-3">
        <span className="grid size-10 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366]"><WhatsApp width={22} height={22} /></span>
        <div className="flex-1">
          <div className="font-display text-base leading-tight text-fg">Get a Quote</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted"><span className="size-2 rounded-full bg-pay" /> The Tyre Mall sales</div>
        </div>
        <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Close"><Close width={18} height={18} /></button>
      </div>

      {/* tabs */}
      <div className="grid grid-cols-2 gap-1 border-b border-line bg-ink p-1.5">
        {([["quote", "Request a quote"], ["chat", "Chat on WhatsApp"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 text-xs font-bold transition-colors ${tab === t ? "bg-[#25D366] text-black" : "text-muted hover:text-fg"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "quote" ? (
          sent ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-pay/15 text-pay"><Check width={28} height={28} /></div>
                <p className="mt-4 font-display text-xl text-fg">Request sent! 🎉</p>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted">Our sales team will get back to you with a quote. Want it faster? Send it on WhatsApp too.</p>
                <a href={whatsappHref(waText)} target="_blank" rel="noopener noreferrer" className="btn mt-4 h-11 bg-[#25D366] px-5 text-black hover:bg-[#1fb757]"><WhatsApp width={17} height={17} /> Send on WhatsApp</a>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-xs text-muted">Tell us what you need and we&apos;ll send you a price. All fields are required.</p>
              <Field label="Name" value={f.name} onChange={set("name")} placeholder="Your name" required />
              <Field label="Email" type="email" value={f.email} onChange={set("email")} placeholder="you@email.com" required />
              <Field label="Mobile" type="tel" value={f.phone} onChange={set("phone")} placeholder="082 …" required />
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Vehicle type <span className="text-sale">*</span></span>
                <select required value={f.vehicle} onChange={set("vehicle")} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt">
                  {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <Field label="Tyre size" value={f.tyreSize} onChange={set("tyreSize")} placeholder="e.g. 205/55R16" />
              <Field label="Rim / wheel size" value={f.rimSize} onChange={set("rimSize")} placeholder="e.g. 17&quot; · 5x114.3" />
              <p className="-mt-1.5 text-[10px] text-faint">Fill in at least one of tyre size or rim / wheel size.</p>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Notes</span>
                <textarea value={f.message} onChange={set("message")} rows={2} placeholder="Anything else?" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-volt" />
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-surface-2 p-2.5">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-volt" />
                <span className="text-[11px] leading-snug text-muted">Please contact me about my quote. I agree to be contacted in line with the <a href="/terms" target="_blank" className="font-semibold text-fg underline hover:text-volt">privacy policy</a> (POPIA).</span>
              </label>
              {err && <p className="rounded-lg border border-sale/40 bg-sale/10 p-2 text-[11px] font-semibold text-sale">{err}</p>}
              <button type="submit" disabled={busy} className="btn btn-volt h-11 w-full disabled:opacity-50">
                {busy ? "Sending…" : "Request quote"}
              </button>
            </form>
          )
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#25D366]/15 text-[#25D366]"><WhatsApp width={32} height={32} /></div>
              <p className="mt-4 font-display text-xl text-fg">Chat to sales on WhatsApp</p>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">Opens WhatsApp with your details pre-filled. Just press send.</p>
              <a href={whatsappHref(waText)} target="_blank" rel="noopener noreferrer" className="btn mt-5 h-12 bg-[#25D366] px-6 text-black hover:bg-[#1fb757]"><WhatsApp width={18} height={18} /> Open WhatsApp</a>
              <p className="mt-4 text-xs text-muted">or email <a href={`mailto:${SHOP_EMAIL}`} className="font-semibold text-fg hover:text-volt">{SHOP_EMAIL}</a><br />call {SHOP_PHONE_DISPLAY}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{label}{required && <span className="text-sale"> *</span>}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
    </label>
  );
}
