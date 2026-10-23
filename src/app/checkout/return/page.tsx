"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart";
import { Check } from "@/components/icons";
import { readPendingPurchase, trackPurchase } from "@/lib/ecommerce-tracking";

function ReturnInner() {
  const ref = useSearchParams().get("ref");
  const { clear } = useCart();
  // Order placed: empty the cart AND wipe the saved checkout (customer details +
  // applied coupon). The coupon is persisted in sessionStorage so it survives the
  // trip to the payment gateway — but if we don't clear it on success, the next
  // checkout silently re-applies it (e.g. a 100%-off coupon = free again).
  useEffect(() => {
    clear();
    try { sessionStorage.removeItem("ttm-checkout"); } catch { /* private mode */ }
  }, [clear]);
  // Back from HappyPay: ask the site to confirm the approval now (no-op for other payments).
  useEffect(() => {
    if (ref) fetch("/api/checkout/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref }) }).catch(() => {});
  }, [ref]);

  // Google Ads / Analytics: report the sale once the payment is confirmed.
  // PayFast only sends shoppers back here after a successful payment, so a
  // PayFast order counts straight away; HappyPay is counted once approved
  // (checked for up to 3 minutes). Never more than once per order.
  useEffect(() => {
    if (!ref) return;
    const pending = readPendingPurchase(ref);
    if (!pending) return;
    let stop = false, tries = 0;
    const check = async () => {
      if (stop) return;
      tries++;
      try {
        const res = await fetch("/api/checkout/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, email: pending.email }) });
        const s = (await res.json()) as { state: string; method?: string; total?: number };
        if (s.state === "paid" || (s.state === "pending" && s.method === "payfast")) { trackPurchase(pending, s.total ?? 0); return; }
        if (s.state === "not_paid" || s.state === "unknown") return;
      } catch { /* try again */ }
      if (tries < 36) setTimeout(check, 5000);
    };
    const t = setTimeout(check, 1500);
    return () => { stop = true; clearTimeout(t); };
  }, [ref]);

  return (
    <div className="container-x grid place-items-center py-24 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-pay/15 text-pay">
          <Check width={40} height={40} />
        </div>
        <h1 className="mt-6 font-display text-4xl">Payment received!</h1>
        <p className="mt-3 text-muted">
          Thank you — your order{ref ? <> <b className="text-fg">{ref}</b></> : ""} is confirmed and now being processed.
          A confirmation email is on its way to you, and our team has been notified.
        </p>
        <Link href="/shop" className="btn btn-volt mt-6">Continue shopping</Link>
      </div>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={<div className="container-x py-24 text-center text-muted">Loading…</div>}>
      <ReturnInner />
    </Suspense>
  );
}
