"use client";

import { useEffect, useRef } from "react";
import { HAPPYPAY_URL } from "@/lib/shop-config";

// Reusable "Check if you qualify" button that opens the official HappyPay
// "how to pay" / eligibility popup (same widget the product page uses). Use it
// anywhere we want the HappyPay modal rather than a link. Pass `amount` (in rand)
// when there's a specific figure; omit it for a general homepage qualify check.
export function HappyPayQualify({
  amount,
  className,
  children,
}: {
  amount?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The widget defines window.show_happy_modal(). Inject it once per page
    // (shared id with the product page so it never loads twice).
    if (document.getElementById("ttm-happypay-widget")) return;
    const el = ref.current;
    if (!el) return;
    const sc = document.createElement("script");
    sc.id = "ttm-happypay-widget";
    sc.className = "happypay_script";
    sc.async = true;
    sc.src = `https://widgets.happypay.co.za/integrations/shopify_widget.js${amount ? `?amount=${amount.toFixed(2)}` : ""}`;
    el.appendChild(sc);
  }, [amount]);

  function open() {
    const w = window as unknown as { show_happy_modal?: () => void; setProductAmount?: (n: number) => void };
    if (typeof w.show_happy_modal === "function") {
      if (amount) w.setProductAmount?.(amount);
      w.show_happy_modal();
    } else {
      // Widget not ready (blocked/slow) — fall back to HappyPay's site.
      window.open(HAPPYPAY_URL, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {children}
      </button>
      <div ref={ref} className="hidden" aria-hidden="true" />
    </>
  );
}
