"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { whatsappHref } from "@/lib/shop-config";
import { validateContact, type ContactErrors } from "@/lib/validate";
import { WhatsApp } from "./icons";

// Remembered on the customer's own device so a returning visitor doesn't retype.
const SAVED_KEY = "ttm-contact";

export interface WhatsAppLead {
  source: "whatsapp-enquiry" | "whatsapp-chat";
  productName?: string;
  sku?: string;
  price?: number;
  productUrl?: string;
}

function loadSaved(): { name: string; email: string; phone: string } {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || "{}");
    return { name: v.name || "", email: v.email || "", phone: v.phone || "" };
  } catch {
    return { name: "", email: "", phone: "" };
  }
}

/** Every WhatsApp hand-off goes through this: it requires a valid name, email
 *  and mobile, saves the lead (Admin → Leads + email to the shop), and only then
 *  opens WhatsApp, so the team can always reach the customer. */
export function WhatsAppGate({
  open, onClose, message, lead,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
  lead: WhatsAppLead;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});

  useEffect(() => {
    if (!open) return;
    const s = loadSaved();
    setName(s.name); setEmail(s.email); setPhone(s.phone); setErrors({});
  }, [open]);

  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const { errors: errs, clean } = validateContact({ name, email, phone }, { name: true, email: true, phone: true });
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const fullMessage = `${message}\nFrom: ${clean.name} (${clean.phone})`;
    // Fire-and-forget (keepalive) so WhatsApp opens inside the click itself;
    // browsers block pop-ups opened after waiting on a network request. The
    // server re-checks the same rules.
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, ...clean, message: fullMessage }),
      keepalive: true,
    }).catch(() => {});
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(clean)); } catch { /* private mode */ }

    const url = whatsappHref(fullMessage);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="wa-gate-title">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form onSubmit={submit} noValidate className="relative w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-5 text-left shadow-2xl">
        <h3 id="wa-gate-title" className="font-display text-lg text-fg">Before we chat</h3>
        <p className="mt-1 text-sm text-muted">
          We need your name, email and mobile in case we lose signal on WhatsApp and need to contact you.
        </p>
        <GateField label="Your name" value={name} onChange={setName} error={errors.name} autoComplete="name" placeholder="Your name" autoFocus />
        <GateField label="Email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" type="email" inputMode="email" placeholder="you@gmail.com" />
        <GateField label="Mobile number" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" type="tel" inputMode="tel" placeholder="082 123 4567" />
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-dark flex-1">Cancel</button>
          <button type="submit" className="btn flex flex-1 items-center justify-center gap-2 bg-[#25D366] text-black hover:bg-[#1fb757]">
            <WhatsApp width={16} height={16} /> Open WhatsApp
          </button>
        </div>
      </form>
    </div>
  );
}

function GateField({
  label, value, onChange, error, type = "text", ...rest
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; type?: string;
  autoComplete?: string; inputMode?: "email" | "tel" | "text"; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label} <span className="text-sale">*</span></span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest}
        className={`h-11 w-full rounded-lg border bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt ${error ? "border-sale" : "border-line"}`}
      />
      {error && <span className="mt-1 block text-xs font-semibold text-sale">{error}</span>}
    </label>
  );
}

/** A button that opens the gate; use anywhere a plain WhatsApp link was. */
export function WhatsAppGateButton({
  message, lead, className = "", children,
}: {
  message: string | (() => string);
  lead: WhatsAppLead;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{children}</button>
      <WhatsAppGate
        open={open}
        onClose={() => setOpen(false)}
        message={typeof message === "function" ? message() : message}
        lead={lead}
      />
    </>
  );
}
