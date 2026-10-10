"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Close } from "@/components/icons";

function CancelledInner() {
  const id = useSearchParams().get("id");
  useEffect(() => {
    if (id) {
      fetch("/api/checkout/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
  }, [id]);

  return (
    <div className="container-x grid place-items-center py-24 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-sale/15 text-sale">
          <Close width={36} height={36} />
        </div>
        <h1 className="mt-6 font-display text-4xl">Payment cancelled</h1>
        <p className="mt-3 text-muted">
          No worries — you were <b className="text-fg">not charged</b>. Your cart is still saved, so you can
          finish checking out whenever you&apos;re ready.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/checkout" className="btn btn-volt">Back to checkout</Link>
          <Link href="/shop" className="btn btn-ghost">Keep shopping</Link>
        </div>
      </div>
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
