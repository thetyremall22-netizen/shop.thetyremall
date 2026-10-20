"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

// Cart Recovery exit-intent reminder (built by iHeart Digital). Only for
// shoppers with items in their cart; only on a genuine exit (pointer leaving
// the top of the window); never in the first few seconds on a page; at most
// once per visitor every N hours. Off unless switched on in Admin.
const SEEN_KEY = "ttm-exit-popup-seen";

interface Cfg { enabled: boolean; title?: string; text?: string; cta?: string; ctaStay?: string; cooldownHours?: number }

export function ExitIntentPopup() {
  const { items } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);
  const armedAt = useRef(0);
  const hasItems = items.length > 0;

  useEffect(() => {
    if (!hasItems || cfg) return;
    fetch("/api/cart-recovery/popup").then((r) => r.json()).then(setCfg).catch(() => setCfg({ enabled: false }));
  }, [hasItems, cfg]);

  useEffect(() => { armedAt.current = Date.now(); }, [pathname]);

  useEffect(() => {
    if (!cfg?.enabled || !hasItems || pathname?.startsWith("/admin") || pathname?.startsWith("/cart/recover")) return;
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return; // not leaving through the top
      if (Date.now() - armedAt.current < 4000) return;
      try {
        const last = Number(localStorage.getItem(SEEN_KEY) || 0);
        const hrs = cfg.cooldownHours ?? 24;
        if (hrs > 0 && Date.now() - last < hrs * 3600_000) return;
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch { /* private mode: still show once */ }
      setOpen(true);
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, [cfg, hasItems, pathname]);

  if (!open || !cfg?.enabled) return null;
  const onCheckout = pathname === "/checkout";

  function engage() {
    let email = "";
    try { email = JSON.parse(sessionStorage.getItem("ttm-checkout") || "{}")?.fields?.email || JSON.parse(localStorage.getItem("ttm-contact") || "{}")?.email || ""; } catch { /* none */ }
    if (email) fetch("/api/cart-recovery/popup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), keepalive: true }).catch(() => {});
    setOpen(false);
    if (!onCheckout) router.push("/checkout");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="exit-title">
      <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-6 text-center shadow-2xl">
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 text-muted hover:text-fg">✕</button>
        <h3 id="exit-title" className="font-display text-xl text-fg">{cfg.title}</h3>
        {cfg.text && <p className="mt-2 text-sm text-muted">{cfg.text}</p>}
        <p className="mt-2 text-xs text-faint">{items.reduce((n, i) => n + i.qty, 0)} item(s) in your cart</p>
        <button onClick={engage} className="btn btn-volt mt-5 h-11 w-full justify-center">{onCheckout ? cfg.ctaStay : cfg.cta}</button>
      </div>
    </div>
  );
}
