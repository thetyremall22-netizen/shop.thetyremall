"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Close } from "@/components/icons";

// Where PayFast / HappyPay send a customer who didn't pay. The order is
// cancelled (never charged). If it was HappyPay (not approved, or the
// application wasn't finished), a pop-up offers to pay for the SAME order with
// PayFast instead (card / Instant EFT), straight from here.

interface CancelInfo { method?: string; canSwitch?: boolean; reference?: string; total?: number }

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CancelledInner() {
  const id = useSearchParams().get("id");
  const [info, setInfo] = useState<CancelInfo | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch("/api/checkout/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      .then((r) => r.json())
      .then((d: CancelInfo) => { setInfo(d); if (d.canSwitch) setOfferOpen(true); })
      .catch(() => {});
  }, [id]);

  async function payWithPayfast() {
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/switch-to-payfast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok || !data.processUrl) { setError(data.error || "Couldn't start the card payment. Please try again."); setBusy(false); return; }
      // Same hidden-form hand-over to PayFast as checkout.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.processUrl;
      for (const [k, v] of Object.entries(data.fields as Record<string, string>)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Network error — please check your connection and try again.");
      setBusy(false);
    }
  }

  const happypay = info?.method === "happypay";

  return (
    <div className="container-x grid place-items-center py-24 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-sale/15 text-sale">
          <Close width={36} height={36} />
        </div>
        <h1 className="mt-6 font-display text-4xl">{happypay ? "HappyPay didn't go through" : "Payment cancelled"}</h1>
        <p className="mt-3 text-muted">
          No worries — you were <b className="text-fg">not charged</b>. Your cart is still saved, so you can
          finish checking out whenever you&apos;re ready.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {info?.canSwitch && <button onClick={() => setOfferOpen(true)} className="btn btn-volt">Pay with card / EFT instead</button>}
          <Link href="/checkout" className={info?.canSwitch ? "btn btn-ghost" : "btn btn-volt"}>Back to checkout</Link>
          <Link href="/shop" className="btn btn-ghost">Keep shopping</Link>
        </div>
      </div>

      {offerOpen && info?.canSwitch && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pf-offer-title">
          <div className="absolute inset-0 bg-black/70" onClick={() => !busy && setOfferOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-6 text-center shadow-2xl">
            <button onClick={() => setOfferOpen(false)} disabled={busy} aria-label="Close" className="absolute right-3 top-3 text-muted hover:text-fg">✕</button>
            <h2 id="pf-offer-title" className="font-display text-2xl text-fg">Pay another way?</h2>
            <p className="mt-2 text-sm text-muted">
              HappyPay couldn&apos;t approve this one (or the application wasn&apos;t finished). You can still get your tyres —
              pay for the same order securely with <b className="text-fg">PayFast</b>.
            </p>
            {/* RCS store cards: the pay-over-time option that works on The Tyre Mall's PayFast account (Nov 2026; MobiCred is unavailable). */}
            <ul className="mt-3 space-y-1.5 text-left text-sm">
              <li className="flex gap-2"><span className="text-volt">✓</span><span><b className="text-fg">Pay over time</b> with your <b className="text-fg">RCS store card</b>: Pick n Pay Smart Shopper, Edgars, Jet, Makro, Game, Builders, RCS, Supa Quick and more</span></li>
              <li className="flex gap-2"><span className="text-volt">✓</span><span>Credit or debit card, Instant EFT, SnapScan, Apple Pay, Google Pay and more</span></li>
            </ul>
            {info.reference && info.total != null && (
              <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                Order <b className="text-fg">{info.reference}</b> · <b className="text-volt">{zar(info.total)}</b>
              </p>
            )}
            <button onClick={payWithPayfast} disabled={busy} className="btn btn-volt mt-5 h-11 w-full justify-center">
              {busy ? "Taking you to PayFast…" : `Pay${info.total != null ? ` ${zar(info.total)}` : ""} with PayFast`}
            </button>
            <Link href="/checkout" className="btn btn-ghost mt-2 h-11 w-full justify-center">Try HappyPay again</Link>
            {error && <p className="mt-3 text-sm font-semibold text-sale">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CancelledPage() {
  return (
    <Suspense fallback={<div className="container-x py-24 text-center text-muted">Loading…</div>}>
      <CancelledInner />
    </Suspense>
  );
}
