// Shop events for Google Analytics 4 and Google Ads, sent through the Google
// tag already on every page (see GoogleTracking): product viewed, added to cart,
// checkout started and — only once the payment is confirmed — purchase.
// Item IDs are "gla_<product id>", the same IDs as the Merchant Center feed, so
// Google Ads can match sales and remarketing to the products in Shopping.
// Consent Mode (cookie banner) decides what Google may store; nothing here
// bypasses it. Browser-only module.
import { ANALYTICS_ENABLED } from "./analytics";

/** Google Ads purchase conversion: "Purchase React Website" (made for this site
 *  on 5 Nov 2026; replaces the old "[10fa] Google for WooCommerce purchase action"). */
const ADS_PURCHASE = "AW-858886436/54H4CPD7yLIdEKSixpkD";

export interface TrackItem { id: number; name: string; brand: string; price: number; qty?: number; type?: string }

type GtagFn = (...args: unknown[]) => void;
function gtag(...args: unknown[]) {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  // Only the real shop reports shop events (never a local test copy).
  if (!/(^|\.)thetyremall\.co\.za$/.test(window.location.hostname)) return;
  const w = window as unknown as { gtag?: GtagFn; dataLayer?: unknown[] };
  if (w.gtag) { w.gtag(...args); return; }
  w.dataLayer = w.dataLayer || [];
  // gtag() must push the `arguments` object itself, not an array.
  // eslint-disable-next-line prefer-rest-params
  (function () { w.dataLayer!.push(arguments); } as (...a: unknown[]) => void)(...args);
}

const rand = (cents: number) => Math.round(cents) / 100;

function items(list: TrackItem[]) {
  return list.map((i) => ({
    item_id: `gla_${i.id}`,
    id: `gla_${i.id}`, // Google Ads dynamic remarketing reads "id"
    google_business_vertical: "retail",
    item_name: i.name,
    item_brand: i.brand,
    item_category: i.type === "wheel" ? "Mag Wheels" : "Tyres",
    price: rand(i.price),
    quantity: i.qty ?? 1,
  }));
}
const valueOf = (list: TrackItem[]) => rand(list.reduce((n, i) => n + i.price * (i.qty ?? 1), 0));

export function trackViewItem(item: TrackItem) {
  gtag("event", "view_item", { currency: "ZAR", value: valueOf([item]), items: items([item]) });
}

export function trackAddToCart(item: TrackItem, qty: number) {
  const it = { ...item, qty };
  gtag("event", "add_to_cart", { currency: "ZAR", value: valueOf([it]), items: items([it]) });
}

export function trackBeginCheckout(list: TrackItem[], totalCents: number) {
  if (!list.length) return;
  gtag("event", "begin_checkout", { currency: "ZAR", value: rand(totalCents), items: items(list) });
}

// ---- purchase ----------------------------------------------------------------
// The checkout page saves what was ordered just before the shopper goes to
// PayFast / HappyPay; the thank-you page sends the purchase once the payment is
// confirmed, at most once per order.

export interface PendingPurchase {
  ref: string;
  items: TrackItem[];
  email: string; phone: string; firstName: string; lastName: string;
  city?: string; province?: string; postalCode?: string;
}
const PENDING_KEY = "ttm-pending-purchase";
const SENT_KEY = "ttm-purchases-sent";

export function savePendingPurchase(p: PendingPurchase) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
export function readPendingPurchase(ref: string): PendingPurchase | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as PendingPurchase | null;
    return p && p.ref === ref ? p : null;
  } catch { return null; }
}
function alreadySent(ref: string): boolean {
  try { return (JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as string[]).includes(ref); } catch { return false; }
}
function markSent(ref: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as string[]).filter((r) => r !== ref);
    localStorage.setItem(SENT_KEY, JSON.stringify([...list, ref].slice(-20)));
    sessionStorage.removeItem(PENDING_KEY);
  } catch { /* private mode */ }
}

/** South African number → +27… (E.164), as Google's enhanced conversions expect. */
function e164(phone: string): string | undefined {
  const d = phone.replace(/\D/g, "");
  if (/^27\d{9}$/.test(d)) return `+${d}`;
  if (/^0\d{9}$/.test(d)) return `+27${d.slice(1)}`;
  return undefined;
}

/** Send the purchase to GA4 and the Google Ads purchase conversion (once per order). */
export function trackPurchase(p: PendingPurchase, totalCents: number) {
  if (alreadySent(p.ref)) return;
  const phone = e164(p.phone);
  // Enhanced conversions: the Google tag normalises and hashes these in the
  // browser before anything is sent.
  gtag("set", "user_data", {
    email: p.email.trim().toLowerCase() || undefined,
    ...(phone ? { phone_number: phone } : {}),
    address: {
      first_name: p.firstName.trim() || undefined, last_name: p.lastName.trim() || undefined,
      city: p.city || undefined, region: p.province || undefined, postal_code: p.postalCode || undefined, country: "ZA",
    },
  });
  const value = rand(totalCents);
  gtag("event", "purchase", { transaction_id: p.ref, currency: "ZAR", value, items: items(p.items) });
  gtag("event", "conversion", { send_to: ADS_PURCHASE, transaction_id: p.ref, currency: "ZAR", value });
  markSent(p.ref);
}

// ---- more shop steps -----------------------------------------------------------

export function trackRemoveFromCart(item: TrackItem) {
  gtag("event", "remove_from_cart", { currency: "ZAR", value: valueOf([item]), items: items([item]) });
}

export function trackViewCart(list: TrackItem[], totalCents: number) {
  if (!list.length) return;
  gtag("event", "view_cart", { currency: "ZAR", value: rand(totalCents), items: items(list) });
}

/** Sent as the shopper leaves for PayFast / HappyPay (payment_type = how they're paying). */
export function trackAddPaymentInfo(list: TrackItem[], totalCents: number, paymentType: string) {
  if (!list.length) return;
  gtag("event", "add_payment_info", { currency: "ZAR", value: rand(totalCents), payment_type: paymentType, items: items(list) });
}

export function trackSearch(term: string) {
  const t = term.trim();
  if (t) gtag("event", "search", { search_term: t.slice(0, 100) });
}

// ---- leads & contact -------------------------------------------------------------
// GA4 events to mark as "key events" in Google Analytics (Admin → Events), and
// import into Google Ads as lead conversions (Goals → Conversions → New →
// Import → Google Analytics 4):
//   generate_lead  — a quote / contact / chat form sent (lead_source says which)
//   click_to_call  — a phone number tapped
//   whatsapp_click — WhatsApp opened
//   email_click    — an email address tapped

/** contact_form · whatsapp_quote · whatsapp_chat · tyrone_chat · tyrone_form */
export function trackLead(source: string) {
  gtag("event", "generate_lead", { lead_source: source, currency: "ZAR", value: 0 });
}

export function trackContactClick(channel: "phone" | "whatsapp" | "email", where: string) {
  const event = channel === "phone" ? "click_to_call" : channel === "whatsapp" ? "whatsapp_click" : "email_click";
  gtag("event", event, { link_location: where.slice(0, 100) });
}

export function trackSignUp() { gtag("event", "sign_up", { method: "email" }); }
export function trackLogin() { gtag("event", "login", { method: "email" }); }
