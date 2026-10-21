"use client";

import { useState, type FormEvent } from "react";
import { validateContact, type ContactErrors } from "@/lib/validate";
import { loadSavedContact, storeSavedContact, type SavedContact } from "@/lib/saved-contact";
import { GateField } from "./WhatsAppGate";
import { EnquiryNotAvailable, useCanBuy } from "./GeoNotice";

/** Inside Tyrone: "Leave your details so the team can get back to you". Not
 *  required to keep chatting; sends a lead (Admin → Leads → Tyrone chat +
 *  email to the shop) with what they asked. */
export function TyroneLeadForm({ questions, onSent }: { questions: string[]; onSent: (c: SavedContact) => void }) {
  const saved = typeof window !== "undefined" ? loadSavedContact() : { name: "", email: "", phone: "" };
  const [name, setName] = useState(saved.name);
  const [email, setEmail] = useState(saved.email);
  const [phone, setPhone] = useState(saved.phone);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canEnquire = useCanBuy();
  if (!canEnquire) return <EnquiryNotAvailable className="text-left" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { errors: errs, clean } = validateContact({ name, email, phone }, { name: true, email: true, phone: true });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    const message = `Tyrone chat — please get back to me.${questions.length ? `\nWhat I asked:\n${questions.map((q) => `• ${q}`).join("\n")}` : ""}`;
    try {
      const res = await fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "tyrone", ...clean, message, productUrl: window.location.href }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrors(d.errors ?? {}); setErr(d.error ?? "Couldn't send — please try again.");
        setBusy(false);
        return;
      }
    } catch {
      setErr("Couldn't send — check your connection and try again."); setBusy(false); return;
    }
    const c = clean as SavedContact;
    storeSavedContact(c);
    onSent(c);
  }

  return (
    <form onSubmit={submit} noValidate className="text-left">
      <GateField label="Your name" value={name} onChange={setName} error={errors.name} autoComplete="name" placeholder="Your name" />
      <GateField label="Email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" type="email" inputMode="email" placeholder="you@gmail.com" />
      <GateField label="Mobile number" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" type="tel" inputMode="tel" placeholder="082 123 4567" />
      {err && <p className="mt-2 text-xs font-semibold text-sale">{err}</p>}
      <button type="submit" disabled={busy} className="btn btn-volt mt-4 w-full disabled:opacity-50">{busy ? "Sending…" : "Send to the team"}</button>
    </form>
  );
}
