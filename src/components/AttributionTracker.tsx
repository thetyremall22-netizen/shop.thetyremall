"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CLICK_KEYS, UTM_KEYS, hostOf, type Attribution, type Touch } from "@/lib/attribution";
import { trackTyrone, tyroneSid } from "@/lib/tyrone-track";

// Remembers where this visitor came from (Google Ads, search, AI, social…) so
// the order can show it, like WooCommerce's order attribution. Stored only in
// this browser; sent with the order at checkout.

const KEY = "ttm-attr-v1";
const SESSION_MS = 30 * 60 * 1000;   // a visit ends after 30 minutes idle
const KEEP_MS = 90 * 86400_000;      // a non-direct source is credited for 90 days

interface Stored extends Attribution { last: number }

function read(): Stored | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function write(s: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

function currentTouch(): Touch {
  const u = new URL(window.location.href);
  const utm: Touch["utm"] = {};
  for (const k of UTM_KEYS) { const v = u.searchParams.get(`utm_${k}`); if (v) utm[k] = v.slice(0, 150); }
  const clickIds: Touch["clickIds"] = {};
  for (const k of CLICK_KEYS) { const v = u.searchParams.get(k); if (v) clickIds[k] = v.slice(0, 200); }
  const ref = document.referrer && hostOf(document.referrer) !== window.location.hostname.replace(/^www\./, "") ? document.referrer : "";
  return { at: Date.now(), referrer: ref.slice(0, 500), landing: `${u.pathname}${u.search}`.slice(0, 500), utm, clickIds };
}
const isDirect = (t: Touch) => !t.referrer && !Object.keys(t.utm).length && !Object.keys(t.clickIds).length;

// The referrer and ad tags only describe the page the visitor ARRIVED on; later
// in-site page changes keep the same document.referrer, so they must not count
// as a fresh arrival.
let arrived = false;

/** Call on every page view. */
function track() {
  const now = Date.now();
  const t = arrived ? { ...currentTouch(), referrer: "", utm: {}, clickIds: {} } : currentTouch();
  arrived = true;
  const s = read();
  const newVisit = !s || now - s.last > SESSION_MS;
  const newSource = !isDirect(t); // an ad / search / link click always starts a new credited visit
  if (!s) {
    write({ touch: t, first: t, sessionPages: 1, visits: 1, last: now });
    return;
  }
  if (newSource || newVisit) {
    // A plain (direct) return visit keeps the earlier non-direct source, like WooCommerce.
    const keepOld = !newSource && !isDirect(s.touch) && now - s.touch.at < KEEP_MS;
    write({ ...s, touch: keepOld ? s.touch : t, sessionPages: 1, visits: s.visits + (newVisit ? 1 : 0), last: now });
    return;
  }
  write({ ...s, sessionPages: s.sessionPages + 1, last: now });
}

/** What checkout sends with the order. */
export function attributionForOrder(): Attribution | null {
  const s = read();
  if (!s) return null;
  const tyrone = tyroneSid();
  return { touch: s.touch, first: s.first, sessionPages: s.sessionPages, visits: s.visits, ...(tyrone ? { tyrone } : {}) };
}

export function AttributionTracker() {
  const path = usePathname();
  useEffect(() => {
    if (path?.startsWith("/admin")) return; // staff browsing the admin isn't a visit
    track();
    // Tyrone conversation journey: shopping pages visited after chatting.
    if (path && /^\/(product|product-category|shop|cart|checkout|wishlist)(\/|$)/.test(path)) trackTyrone("page_view", { label: path });
  }, [path]);
  return null;
}
