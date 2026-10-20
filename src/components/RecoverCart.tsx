"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Must match the cart store key in lib/cart.tsx.
const CART_KEY = "ttm-cart-v2";

/** "Complete my order" from a recovery email: rebuilds the cart, pre-fills the
 *  checkout details (and any discount code), then opens checkout. */
export function RecoverCart() {
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = sp.get("t");
    if (!t) { setError("This link is incomplete."); return; }
    fetch(`/api/cart-recovery/restore?t=${encodeURIComponent(t)}`)
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error ?? "This link has expired."); return; }
        if (!d.items?.length) { setError("The tyres in this cart are no longer available."); return; }
        try {
          let current: Record<string, unknown> = {};
          try { current = JSON.parse(localStorage.getItem(CART_KEY) || "{}"); } catch { /* fresh */ }
          localStorage.setItem(CART_KEY, JSON.stringify({ deliveryMethod: "delivery", fitmentStoreId: null, fitmentDate: null, ...current, items: d.items }));
          sessionStorage.setItem("ttm-checkout", JSON.stringify({ fields: d.fields, couponCode: d.couponCode }));
        } catch { /* private mode: still go to checkout */ }
        window.location.replace("/checkout");
      })
      .catch(() => setError("We couldn't restore your cart. Please try again."));
  }, [sp]);

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl">Hmm, that didn&apos;t work</h1>
        <p className="mt-2 text-muted">{error}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/shop" className="btn btn-volt h-11 px-5">Shop tyres</Link>
          <a href="tel:0780088788" className="btn btn-ghost h-11 px-5">Call 078 0088 788</a>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mx-auto size-10 animate-spin rounded-full border-4 border-line border-t-volt" />
      <p className="mt-4 text-muted">Restoring your cart…</p>
    </div>
  );
}
