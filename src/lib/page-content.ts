import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import type { Metadata } from "next";
import { libsql } from "./db";
import { cleanShopLink } from "./shop-url";

// Admin-editable parts of the main landing pages: header (small line, two-tone
// heading, intro), an optional banner, an optional extra content block, and the
// Google title/description. Anything left blank shows the page's built-in text.
// Shop and product pages are NOT here — they're managed in Products.

export interface PageOverride {
  eyebrow: string;
  silver: string;
  green: string;
  intro: string;
  banner: { src: string; href: string; alt: string };
  extraHeading: string;
  extraBody: string;
  extraPosition: "top" | "bottom";
  seoTitle: string;
  seoDescription: string;
}

export interface PageDef {
  key: string;
  path: string;
  label: string;
  defaults: { eyebrow: string; silver: string; green: string; intro: string; seoTitle: string; seoDescription: string };
}

export const EMPTY_OVERRIDE: PageOverride = {
  eyebrow: "", silver: "", green: "", intro: "",
  banner: { src: "", href: "", alt: "" },
  extraHeading: "", extraBody: "", extraPosition: "bottom",
  seoTitle: "", seoDescription: "",
};

export const PAGES: PageDef[] = [
  { key: "about", path: "/about", label: "About us", defaults: {
    eyebrow: "Backed by the Trump Tyre Group · B-BBEE Level 1", silver: "ABOUT", green: "THE TYRE MALL",
    intro: "Your premier online destination for tyres and wheels in South Africa. Backed by the heritage of the Trump Tyre Group, we've built our reputation on quality, value and service.",
    seoTitle: "About Us — The Tyre Mall", seoDescription: "" } },
  { key: "contact", path: "/contact-us/", label: "Contact us", defaults: {
    eyebrow: "We're here to help", silver: "GET IN", green: "TOUCH",
    intro: "Questions about tyres, fitment, delivery or an existing order? Our team answers fast — call, WhatsApp, email or drop us a message below.",
    seoTitle: "Contact us", seoDescription: "Get in touch with The Tyre Mall — call, WhatsApp or email. Nationwide delivery and Johannesburg fitment." } },
  { key: "faq", path: "/faq", label: "FAQ", defaults: {
    eyebrow: "", silver: "", green: "", intro: "",
    seoTitle: "Tyre FAQ — Buying, Fitting & Caring for Tyres", seoDescription: "" } },
  { key: "delivery-areas", path: "/delivery-areas", label: "Free delivery areas", defaults: {
    eyebrow: "Nationwide — every province", silver: "FREE DELIVERY", green: "AREAS",
    intro: "We deliver tyres and mag wheels to every corner of South Africa. Order 2 or more tyres and delivery is free — straight to your door or to a partner fitment centre near you.",
    seoTitle: "Free Delivery Areas — Nationwide Across South Africa", seoDescription: "" } },
  { key: "stores", path: "/stores", label: "Stores & fitment centres", defaults: {
    eyebrow: "Buy online · fit in Joburg", silver: "OUR", green: "STORES",
    intro: "Order online and have your tyres fitted at one of our trusted partner centres across Johannesburg. Each centre sets and charges its own fitment price. Phone ahead to book.",
    seoTitle: "Our Stores & Fitment Centres", seoDescription: "" } },
  { key: "radar-protect", path: "/radar-protect", label: "Radar Protect", defaults: {
    eyebrow: "12-month road hazard cover", silver: "RADAR", green: "PROTECT",
    intro: "Selected Radar tyres from The Tyre Mall include Radar Protect — extra peace of mind if your eligible Radar tyre is damaged by everyday road hazards. Offered by Radar Tyres and their authorised distributors.",
    seoTitle: "Radar Protect — 12-Month Road Hazard Protection", seoDescription: "" } },
  { key: "how-to-apply-for-credit-online", path: "/how-to-apply-for-credit-online/", label: "How to apply for credit (HappyPay)", defaults: {
    eyebrow: "How to apply for credit online with HappyPay", silver: "BUY NOW,", green: "PAY LATER",
    intro: "Get your tyres and mag wheels today and pay in two interest-free payments over your next two paydays — no deposit, and an instant decision at checkout with HappyPay.",
    seoTitle: "How to Apply for Credit Online — Buy Now, Pay Later with HappyPay", seoDescription: "" } },
  { key: "returns", path: "/returns", label: "Returns & refunds", defaults: {
    eyebrow: "Your rights under the CPA", silver: "RETURNS &", green: "REFUNDS",
    intro: "Changed your mind or received a faulty tyre? Here's exactly how returns, cancellations and refunds work — always contact us first so we can guide you through it.",
    seoTitle: "Returns & Refunds Policy", seoDescription: "" } },
  { key: "terms", path: "/terms", label: "Terms & conditions", defaults: {
    eyebrow: "", silver: "TERMS &", green: "CONDITIONS", intro: "",
    seoTitle: "Terms & Conditions", seoDescription: "" } },
  { key: "mag-wheels", path: "/mag-wheels", label: "Mag wheels (Wheel Shop)", defaults: {
    eyebrow: "The Wheel Shop", silver: "MAG", green: "WHEELS",
    intro: "15\" to 20\" · bakkie, 4×4 & replica designs. Turn heads on every street.",
    seoTitle: "The Wheel Shop — Mag Wheels", seoDescription: "Shop mag wheels at The Tyre Mall — 15\" to 20\", bakkie & replica designs, nationwide delivery and fitment." } },
  { key: "blog", path: "/blog", label: "Blog", defaults: {
    eyebrow: "", silver: "", green: "", intro: "",
    seoTitle: "Blog — Tyre Tips, Guides & News", seoDescription: "" } },
];

export const PAGE_KEYS = PAGES.map((p) => p.key);
export const PAGE_CONTENT_TAG = "page-content";

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS page_content (
    page TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

function normalise(raw: unknown): PageOverride {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = (o.banner && typeof o.banner === "object" ? o.banner : {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    eyebrow: s(o.eyebrow), silver: s(o.silver), green: s(o.green), intro: s(o.intro),
    banner: { src: s(b.src), href: cleanShopLink(s(b.href)), alt: s(b.alt) },
    extraHeading: s(o.extraHeading), extraBody: s(o.extraBody), extraPosition: o.extraPosition === "top" ? "top" : "bottom",
    seoTitle: s(o.seoTitle), seoDescription: s(o.seoDescription),
  };
}

export async function readPageRaw(key: string): Promise<PageOverride> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT value FROM page_content WHERE page = ?", args: [`page:${key}`] });
    return normalise(r.rows.length ? JSON.parse(String(r.rows[0].value)) : {});
  } catch {
    return EMPTY_OVERRIDE;
  }
}

export async function readAllPagesRaw(): Promise<Record<string, PageOverride>> {
  const out: Record<string, PageOverride> = {};
  for (const p of PAGES) out[p.key] = await readPageRaw(p.key);
  return out;
}

/** Cached for the storefront; invalidated when an admin saves. */
export async function getPageContent(key: string): Promise<PageOverride> {
  "use cache";
  cacheTag(PAGE_CONTENT_TAG);
  cacheLife("max");
  return readPageRaw(key);
}

export async function savePageContent(key: string, value: PageOverride): Promise<void> {
  await ensureTable();
  await libsql.execute({
    sql: `INSERT INTO page_content (page, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(page) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [`page:${key}`, JSON.stringify(value), Date.now()],
  });
  revalidateTag(PAGE_CONTENT_TAG, "max");
}

/** Page metadata with any admin SEO overrides applied. */
export async function pageMetadata(key: string, base: Metadata): Promise<Metadata> {
  const o = await getPageContent(key);
  return {
    ...base,
    ...(o.seoTitle ? { title: o.seoTitle } : {}),
    ...(o.seoDescription ? { description: o.seoDescription } : {}),
  };
}
