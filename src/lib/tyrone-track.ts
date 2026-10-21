"use client";

// Browser side of Tyrone conversation tracking. A conversation id is created
// with the visitor's first Tyrone question and kept for 7 days of activity; while
// it's active, Tyrone clicks, product/cart/checkout pages, add-to-cart and the
// order are reported so Admin → Leads → Tyrone conversations shows the outcome.

const KEY = "ttm-tyrone-sid";
const KEEP_MS = 7 * 86400_000;

type Stored = { id: string; last: number };
function read(): Stored | null {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null") as Stored | null; return s && Date.now() - s.last < KEEP_MS ? s : null; } catch { return null; }
}
function write(s: Stored) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

/** The active conversation id (if this visitor has used Tyrone recently). */
export function tyroneSid(): string | null { return read()?.id ?? null; }

/** Start (or continue) a conversation — called when they ask Tyrone something. */
export function startTyroneSid(): string {
  const s = read();
  const id = s?.id ?? (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  write({ id, last: Date.now() });
  return id;
}

export type TrackType = "question" | "product_click" | "link_click" | "details" | "whatsapp" | "page_view" | "add_to_cart" | "checkout";

/** Record one step (only when a conversation is active, unless `start`). */
export function trackTyrone(type: TrackType, data: { label?: string; href?: string } = {}, opts: { start?: boolean; contact?: { name: string; email: string; phone: string } } = {}) {
  const sid = opts.start ? startTyroneSid() : tyroneSid();
  if (!sid) return;
  if (!opts.start) write({ id: sid, last: Date.now() });
  const body = JSON.stringify({ sid, events: [{ type, label: data.label, href: data.href, page: window.location.pathname }], contact: opts.contact });
  fetch("/api/tyrone/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
