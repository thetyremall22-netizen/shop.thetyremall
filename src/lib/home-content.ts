import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";

// Admin-editable home page: marketing banners (1 static or up to 3 rotating),
// hero background, the two feature tiles, section headings + show/hide, the
// HappyPay block and an optional featured video. Stored as one JSON document;
// anything not set falls back to the shipped defaults below.

export const MAX_BANNERS = 3;

export interface Banner { src: string; alt: string; href: string }
export interface Tile { title: string; tags: string; href: string; cta: string; image: string }
export interface Heading { show: boolean; eyebrow: string; silver: string; green: string }

export interface HomeContent {
  banners: { show: boolean; mode: "static" | "rotate"; intervalSec: number; slides: Banner[] };
  hero: { image: string };
  tiles: { show: boolean; items: [Tile, Tile] };
  reviews: Heading;
  fanFavourites: Heading;
  happyPay: { show: boolean; heading: string; body: string; cta: string };
  deals: Heading;
  mags: Heading;
  about: { show: boolean };
  brands: Heading;
  video: { show: boolean; youtubeId: string; heading: string; caption: string };
}

export const HOME_DEFAULTS: HomeContent = {
  banners: {
    show: true, mode: "static", intervalSec: 6,
    slides: [{
      src: "/promo/radar-renegade-outdoorfest.webp",
      href: "/shop?q=Renegade",
      alt: "Radar Renegade Outdoor Fest — buy a set of 4 Renegades and stand a chance to win a braai. 4 weeks, 4 winners.",
    }],
  },
  hero: { image: "/brand/hero-bg.webp" },
  tiles: {
    show: true,
    items: [
      { title: "TYRES", tags: "Passenger | SUV & 4×4 | Light Truck | Truck & Bus", href: "/shop?type=tyre", cta: "Shop Tyres", image: "/brand/tile-tyres.webp" },
      { title: "WHEELS", tags: "Alloy | Steel | Off-Road | OEM Fitment", href: "/shop?type=wheel", cta: "Shop Wheels", image: "/brand/tile-wheels.webp" },
    ],
  },
  reviews: { show: true, eyebrow: "{rating}★ loved across Mzansi", silver: "HAPPY", green: "CUSTOMERS" },
  fanFavourites: { show: true, eyebrow: "Flying out the door", silver: "FAN", green: "FAVOURITES" },
  happyPay: {
    show: true,
    heading: "BUY NOW\nAND PAY LATER",
    body: "See if you qualify for credit! Drive now and pay in easy monthly instalments — instant approval at checkout, no paperwork, no fuss.",
    cta: "Check if you qualify →",
  },
  deals: { show: true, eyebrow: "🔥 Limited time only", silver: "MASSIVE", green: "SAVINGS" },
  mags: { show: true, eyebrow: "Turn heads on every street", silver: "FRESH", green: "MAGS" },
  about: { show: true },
  brands: { show: true, eyebrow: "Stocked & ready to ship", silver: "SHOP BY", green: "BRAND" },
  video: { show: false, youtubeId: "", heading: "", caption: "" },
};

export const HOME_TAG = "home-content";

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

/** Deep-merge stored values over the defaults (objects only; arrays replace). */
function merge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || Array.isArray(over) || !base || typeof base !== "object" || Array.isArray(base)) {
    return (over === undefined || over === null ? base : over) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = k in out ? merge(out[k], v) : v;
  }
  return out as T;
}

export async function readHomeRaw(): Promise<HomeContent> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT value FROM page_content WHERE page = 'home'", args: [] });
    const stored = r.rows.length ? JSON.parse(String(r.rows[0].value)) : {};
    const out = merge(HOME_DEFAULTS, stored);
    out.banners.slides = (out.banners.slides ?? []).slice(0, MAX_BANNERS);
    return out;
  } catch {
    return HOME_DEFAULTS;
  }
}

/** Cached for the storefront; invalidated when an admin saves. */
export async function getHomeContent(): Promise<HomeContent> {
  "use cache";
  cacheTag(HOME_TAG);
  cacheLife("max");
  return readHomeRaw();
}

export async function saveHomeContent(next: HomeContent): Promise<void> {
  await ensureTable();
  next.banners.slides = next.banners.slides.slice(0, MAX_BANNERS);
  await libsql.execute({
    sql: `INSERT INTO page_content (page, value, updated_at) VALUES ('home', ?, ?)
          ON CONFLICT(page) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [JSON.stringify(next), Date.now()],
  });
  revalidateTag(HOME_TAG, "max");
}
