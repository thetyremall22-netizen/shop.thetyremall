"use client";

import { useEffect, useState } from "react";
import { SHOP_EMAIL, SHOP_PHONE_DISPLAY, SHOP_PHONE_TEL } from "@/lib/shop-config";
import { Close } from "./icons";

// "South Africa only" for buying. Everyone can browse the shop (Google, ads,
// Facebook/WhatsApp previews keep working); visitors outside South Africa
// can't add to cart or check out. The server marks each visitor with the
// readable "ttm_geo" cookie ("out" = outside SA); checkout is also refused on
// the server, so clearing the cookie doesn't get round it.

export const GEO_BLOCKED_EVENT = "ttm:geo-blocked";

export function canBuyNow(): boolean {
  if (typeof document === "undefined") return true;
  return !/(?:^|;\s*)ttm_geo=out(?:;|$)/.test(document.cookie);
}

/** false only for visitors outside South Africa (after the page has loaded). */
export function useCanBuy(): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOk(canBuyNow()), 0);
    return () => clearTimeout(t);
  }, []);
  return ok;
}

/** True for visitors in a neighbouring country (they can buy, SA delivery only). */
export function useIsNeighbour(): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setNear(/(?:^|;\s*)ttm_geo=near(?:;|$)/.test(document.cookie)), 0);
    return () => clearTimeout(t);
  }, []);
  return near;
}

/** Tell the visitor (pop-up) — used by the cart when an add is refused. */
export function showGeoBlocked() {
  window.dispatchEvent(new Event(GEO_BLOCKED_EVENT));
}

export function NotAvailableNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-fg ${className}`}>
      <b>Sorry, you can&apos;t buy from outside South Africa.</b>{" "}
      <span className="text-muted">The Tyre Mall only sells and delivers tyres and mag wheels within South Africa, so we can&apos;t sell or ship to your country. In South Africa? Switch off any VPN and refresh the page, or call <a href={`tel:${SHOP_PHONE_TEL}`} className="font-semibold text-volt">{SHOP_PHONE_DISPLAY}</a>.</span>
    </div>
  );
}

/** Pop-up shown when someone outside South Africa tries to add to cart / buy. */
export function GeoBlockedDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(GEO_BLOCKED_EVENT, on);
    return () => window.removeEventListener(GEO_BLOCKED_EVENT, on);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="geo-title">
      <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-6 text-center shadow-2xl">
        <button onClick={() => setOpen(false)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Close"><Close width={16} height={16} /></button>
        <div className="text-4xl" aria-hidden>🇿🇦</div>
        <h2 id="geo-title" className="mt-2 font-display text-2xl">We only sell in South Africa</h2>
        <p className="mt-2 text-sm text-muted">Sorry, you&apos;re not able to purchase from your country. The Tyre Mall only sells and ships tyres and mag wheels within South Africa.</p>
        <p className="mt-2 text-xs text-muted">In South Africa? Switch off any VPN and refresh, or contact us on <a href={`tel:${SHOP_PHONE_TEL}`} className="font-semibold text-volt">{SHOP_PHONE_DISPLAY}</a> / <a href={`mailto:${SHOP_EMAIL}`} className="font-semibold text-volt">{SHOP_EMAIL}</a>.</p>
        <button onClick={() => setOpen(false)} className="btn btn-volt mt-5 w-full">OK, keep browsing</button>
      </div>
    </div>
  );
}

/** Thin bar at the top of every page for visitors outside South Africa. */
export function GeoBanner() {
  const canBuy = useCanBuy();
  if (canBuy) return null;
  return (
    <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-semibold text-black">
      🇿🇦 You&apos;re browsing from outside South Africa. The Tyre Mall only sells and delivers within South Africa, so online purchases aren&apos;t available in your country.
    </div>
  );
}

/** Shown instead of enquiry forms (WhatsApp, quote, contact) for visitors
 *  outside South Africa (the server refuses their enquiries too). */
export function EnquiryNotAvailable({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-fg ${className}`}>
      <b>Sorry, we do not take enquiries from outside South Africa.</b>{" "}
      <span className="text-muted">The Tyre Mall only sells and delivers tyres and mag wheels within South Africa. In South Africa? Switch off any VPN and refresh the page.</span>
    </div>
  );
}
