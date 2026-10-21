"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { whatsappHref } from "@/lib/shop-config";
import { validateContact, type ContactErrors } from "@/lib/validate";
import { loadSavedContact, storeSavedContact } from "@/lib/saved-contact";
import { WhatsApp } from "./icons";
import { EnquiryNotAvailable, useCanBuy } from "./GeoNotice";

export interface WhatsAppLead {
  source: "whatsapp-enquiry" | "whatsapp-chat" | "tyrone";
  productName?: string;
  sku?: string;
  price?: number;
  productUrl?: string;
}

/** The details step itself: a valid name, email and mobile are required; the
 *  lead is saved (Admin → Leads + email to the shop) and only then does
 *  WhatsApp open, so the team can always reach the customer if the chat drops. */
export function WhatsAppDetailsForm({
  message, lead, onDone, onCancel, intro, submitLabel = "Open WhatsApp",
}: {
  message: string;
  lead: WhatsAppLead;
  onDone?: () => void;
  onCancel?: () => void;
  intro?: ReactNode;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<ContactErrors>({});

  const canEnquire = useCanBuy(); // outside South Africa: no enquiries
  // A returning visitor's details are remembered on their device.
  useEffect(() => {
    const s = loadSavedContact();
    const t = setTimeout(() => { setName(s.name); setEmail(s.email); setPhone(s.phone); }, 0);
    return () => clearTimeout(t);
  }, []);

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
    storeSavedContact(clean as { name: string; email: string; phone: string });

    const url = whatsappHref(fullMessage);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
    onDone?.();
  }

  if (!canEnquire) return <EnquiryNotAvailable className="text-left" />;
  return (
    <form onSubmit={submit} noValidate className="text-left">
      {intro ?? (
        <p className="text-sm text-muted">We need your name, email and mobile in case we lose signal on WhatsApp and need to contact you.</p>
      )}
      <GateField label="Your name" value={name} onChange={setName} error={errors.name} autoComplete="name" placeholder="Your name" />
      <GateField label="Email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" type="email" inputMode="email" placeholder="you@gmail.com" />
      <GateField label="Mobile number" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" type="tel" inputMode="tel" placeholder="082 123 4567" />
      <div className="mt-5 flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="btn btn-dark flex-1">Cancel</button>}
        <button type="submit" className="btn flex flex-1 items-center justify-center gap-2 bg-[#25D366] text-black hover:bg-[#1fb757]">
          <WhatsApp width={16} height={16} /> {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** The same step as a pop-up, for WhatsApp buttons elsewhere on the site. */
export function WhatsAppGate({
  open, onClose, message, lead,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
  lead: WhatsAppLead;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="wa-gate-title">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-5 shadow-2xl">
        <h3 id="wa-gate-title" className="font-display text-lg text-fg">Before we chat</h3>
        <WhatsAppDetailsForm message={message} lead={lead} onDone={onClose} onCancel={onClose}
          intro={<p className="mt-1 text-sm text-muted">We need your name, email and mobile in case we lose signal on WhatsApp and need to contact you.</p>} />
      </div>
    </div>
  );
}

export function GateField({
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
