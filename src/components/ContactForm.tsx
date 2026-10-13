"use client";

import { useState } from "react";
import { Check } from "./icons";

const REASONS = ["General enquiry", "Help with an order", "Fitment question", "Delivery / returns", "Bulk / fleet pricing"];

export function ContactForm() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send — please try again, or call us.");
        setSending(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — please try again, or call us on 078 0088 788.");
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-pay/40 bg-pay/5 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pay/15 text-pay"><Check width={22} height={22} /></span>
        <div>
          <div className="font-bold text-fg">Message sent — thank you!</div>
          <p className="text-sm text-muted">We&apos;ve received your message and will be in touch shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" label="Your name" required />
        <Input name="email" label="Email" type="email" required />
        <Input name="phone" label="Mobile" type="tel" required />
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Reason <span className="text-sale">*</span></span>
          <select name="reason" required className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt">
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">Message <span className="text-sale">*</span></span>
        <textarea name="message" required rows={5} className="w-full rounded-lg border border-line bg-surface-2 p-3 text-sm text-fg outline-none focus:border-volt" placeholder="How can we help?" />
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-surface-2 p-3">
        <input type="checkbox" name="contactConsent" defaultChecked value="yes" className="mt-0.5 size-4 accent-volt" />
        <span className="text-xs leading-snug text-muted">Please contact me. I agree to be contacted about my enquiry in line with the <a href="/terms" target="_blank" className="font-semibold text-fg underline hover:text-volt">privacy policy</a> (POPIA).</span>
      </label>
      {error && <div className="rounded-lg border border-sale/40 bg-sale/10 p-2.5 text-sm font-semibold text-sale">{error}</div>}
      <button type="submit" disabled={sending} className="btn btn-volt w-full py-3.5 disabled:opacity-60">
        {sending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Input({ name, label, type = "text", required }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}{required && <span className="text-sale"> *</span>}</span>
      <input name={name} type={type} required={required} className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
    </label>
  );
}
