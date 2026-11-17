"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";

// Cart Recovery exit-intent reminder (built by iHeart Digital). Only for
// shoppers with items in their cart, at most once per visitor every N hours,
// never in the first few seconds on a page. Off unless switched on in Admin.
//
// When it appears:
//  • Computers: the pointer leaves through the top of the window.
//  • Phones/tablets (no mouse): pressing Back on the cart or checkout page, or
//    coming back to the site after switching away for a while.
//
// Every showing and tap is logged (Admin → Abandoned Cart) so its results can
// be measured, and a tap is credited to the cart if they go on to pay.
const SEEN_KEY = "ttm-exit-popup-seen";
const TAPPED_KEY = "ttm-exit-tapped";
const RETURN_AFTER_MS = 15_000; // away from the site at least this long

type Trigger = "mouse_exit" | "back_button" | "tab_return";
interface Cfg { enabled: boolean; title?: string; text?: string; cta?: string; ctaStay?: string; cooldownHours?: number }

const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;

function knownEmail(): string {
  try {
    return JSON.parse(sessionStorage.getItem("ttm-checkout") || "{}")?.fields?.email || JSON.parse(localStorage.getItem("ttm-contact") || "{}")?.email || "";
  } catch { return ""; }
}

function log(body: Record<string, unknown>) {
  fetch("/api/cart-recovery/popup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

export function ExitIntentPopup() {
  const { items } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<Trigger>("mouse_exit");
  const [mobile, setMobile] = useState(false);
  const armedAt = useRef(0);
  const hasItems = items.length > 0;
  const blockedPage = !!pathname && (pathname.startsWith("/admin") || pathname.startsWith("/cart/recover") || pathname.startsWith("/checkout/return"));

  useEffect(() => { setMobile(!!isTouchDevice()); }, []);

  useEffect(() => {
    if (!hasItems || cfg) return;
    fetch("/api/cart-recovery/popup").then((r) => r.json()).then(setCfg).catch(() => setCfg({ enabled: false }));
  }, [hasItems, cfg]);

  useEffect(() => { armedAt.current = Date.now(); }, [pathname]);

  const coolingDown = useCallback((): boolean => {
    try {
      const last = Number(localStorage.getItem(SEEN_KEY) || 0);
      const hrs = cfg?.cooldownHours ?? 24;
      return hrs > 0 && Date.now() - last < hrs * 3600_000;
    } catch { return false; }
  }, [cfg]);

  /** Show the popup now (unless it was shown recently). Returns whether it showed. */
  const show = useCallback((t: Trigger): boolean => {
    if (coolingDown()) return false;
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode: still show once */ }
    setTrigger(t);
    setOpen(true);
    log({ event: "shown", device: isTouchDevice() ? "mobile" : "desktop", trigger: t });
    return true;
  }, [coolingDown]);

  const active = !!cfg?.enabled && hasItems && !blockedPage;

  // Computers: pointer leaves through the top of the window.
  useEffect(() => {
    if (!active || mobile) return;
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return; // not leaving through the top
      if (Date.now() - armedAt.current < 4000) return;
      show("mouse_exit");
    };
    document.addEventListener("mouseout", onOut);
    return () => document.removeEventListener("mouseout", onOut);
  }, [active, mobile, show]);

  // Phones: Back on the cart or checkout page shows the reminder first (once;
  // pressing Back again leaves as normal).
  useEffect(() => {
    if (!active || !mobile || (pathname !== "/cart" && pathname !== "/checkout") || coolingDown()) return;
    let armed = true;
    // An extra history step on the same page, carrying the router's own state.
    try { window.history.pushState({ ...(window.history.state ?? {}), ttmExitGuard: true }, ""); } catch { return; }
    const onPop = () => {
      if (!armed) return;
      armed = false;
      window.removeEventListener("popstate", onPop);
      if (!show("back_button")) window.history.back(); // shown recently: just carry on leaving
    };
    window.addEventListener("popstate", onPop);
    return () => { armed = false; window.removeEventListener("popstate", onPop); };
  }, [active, mobile, pathname, coolingDown, show]);

  // Phones: coming back to the site after switching to another app/tab.
  useEffect(() => {
    if (!active || !mobile) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= RETURN_AFTER_MS) show("tab_return");
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, mobile, show]);

  if (!open || !cfg?.enabled) return null;
  const onCheckout = pathname === "/checkout";

  function engage() {
    const email = knownEmail();
    log({ event: "tapped", device: isTouchDevice() ? "mobile" : "desktop", trigger, email });
    // Remembered so checkout can credit the popup once we have their email.
    try { localStorage.setItem(TAPPED_KEY, String(Date.now())); } catch { /* ignore */ }
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
