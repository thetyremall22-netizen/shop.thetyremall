"use client";

import { useCallback, useEffect, useRef } from "react";
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
  const wantOpen = useRef(false);

  // The widget defines window.show_happy_modal(). It also pulls in jQuery and
  // HappyPay's fonts, so it only loads when the button is nearly on screen (or
  // is tapped) — not during the first paint, where it slowed phones down.
  // Shared id with the product page so it never loads twice.
  const load = useCallback(() => {
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

  useEffect(() => {
    const el = ref.current?.previousElementSibling;
    if (!el || typeof IntersectionObserver === "undefined") return load();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  function open() {
    const w = window as unknown as { show_happy_modal?: () => void; setProductAmount?: (n: number) => void };
    if (typeof w.show_happy_modal === "function") {
      if (amount) w.setProductAmount?.(amount);
      w.show_happy_modal();
      return;
    }
    // Not loaded yet: load it now and open once ready; fall back to HappyPay's site if it never arrives.
    if (wantOpen.current) return;
    wantOpen.current = true;
    load();
    const started = Date.now();
    const t = setInterval(() => {
      if (typeof w.show_happy_modal === "function") {
        clearInterval(t); wantOpen.current = false;
        if (amount) w.setProductAmount?.(amount);
        w.show_happy_modal();
      } else if (Date.now() - started > 4000) {
        clearInterval(t); wantOpen.current = false;
        window.open(HAPPYPAY_URL, "_blank", "noopener,noreferrer");
      }
    }, 150);
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
