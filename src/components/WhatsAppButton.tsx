"use client";

import { useState, type FormEvent } from "react";
import { formatPrice } from "@/lib/format";
import { whatsappHref } from "@/lib/shop-config";
import { WhatsApp } from "./icons";

export function WhatsAppButton({
  slug, name, sku, size, price, setPrice, className = "",
}: {
  slug: string;
  name: string;
  sku?: string;
  size?: string;
  price: number;
  setPrice?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [sending, setSending] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const productUrl = `${origin}/product/${slug}`;

  function buildMessage(): string {
    return [
      "Hi The Tyre Mall! I'd like to enquire about this tyre:",
      name,
      [size ? `Size: ${size}` : null, sku ? `SKU: ${sku}` : null].filter(Boolean).join(" · "),
      `Price: ${formatPrice(price)} per tyre${setPrice ? ` (Set of 4: ${formatPrice(setPrice)})` : ""}`,
      cName.trim() ? `From: ${cName.trim()}${cPhone.trim() ? ` (${cPhone.trim()})` : ""}` : null,
      productUrl,
    ].filter(Boolean).join("\n");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!cName.trim() || !cPhone.trim() || sending) return;
    setSending(true);
    const message = buildMessage();
    // Capture the lead (DB + email to the shop) before opening WhatsApp, so the
    // details aren't lost even if the customer never sends the message.
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "whatsapp-enquiry",
          name: cName.trim(), phone: cPhone.trim(),
          productName: name, sku, price, productUrl, message,
        }),
        keepalive: true,
      });
    } catch { /* ignore — still open WhatsApp */ }
    window.open(whatsappHref(message), "_blank", "noopener,noreferrer");
    setSending(false);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn flex items-center justify-center gap-2 border border-[#25D366]/60 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 ${className}`}
      >
        <WhatsApp width={18} height={18} /> WhatsApp us
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => !sending && setOpen(false)} />
          <form onSubmit={submit} className="relative w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-5 shadow-2xl">
            <h3 className="font-display text-lg text-fg">Before we chat</h3>
            <p className="mt-1 text-sm text-muted">
              Pop in your name &amp; mobile so we can reach you if we lose signal on WhatsApp.
            </p>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold text-muted">Your name *</span>
              <input
                value={cName} onChange={(e) => setCName(e.target.value)} required autoFocus
                placeholder="Your name"
                className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-muted">Mobile number *</span>
              <input
                value={cPhone} onChange={(e) => setCPhone(e.target.value)} required type="tel"
                placeholder="082 …"
                className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={sending} className="btn btn-dark flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !cName.trim() || !cPhone.trim()}
                className="btn flex flex-1 items-center justify-center gap-2 bg-[#25D366] text-black hover:bg-[#1fb757] disabled:opacity-60"
              >
                <WhatsApp width={16} height={16} /> {sending ? "Opening…" : "Open WhatsApp"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
