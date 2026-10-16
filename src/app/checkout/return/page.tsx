"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart";
import { Check } from "@/components/icons";

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
