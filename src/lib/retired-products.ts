import "server-only";
import retiredData from "@/data/retired-products.json";
import { getProducts, dealProducts } from "./catalogue";
import { getBrandDirectory } from "./brand-registry";
import type { Product } from "./types";

// Old WooCommerce products that aren't in the new shop (listed by Merchant
// Center as "Product page unavailable"). Their old addresses — and any other
// old /product/ link that names a tyre size or a mag wheel — show a "no longer
// available" page with similar products we do sell, instead of a dead end.
// Refresh the list with: python3 scripts/import-retired-products.py report.csv

export interface RetiredProduct { id: number; title: string; slug: string }

const BY_SLUG = new Map((retiredData as RetiredProduct[]).map((r) => [r.slug, r]));

/** A retired product by its old slug (old WordPress duplicates end in -2, -3…). */
export function findRetired(slug: string): RetiredProduct | null {
  const s = decodeURIComponent(slug).toLowerCase().replace(/\/+$/, "");
  return BY_SLUG.get(s) ?? BY_SLUG.get(s.replace(/-\d{1,2}$/, "")) ?? null;
}

export interface Wanted {
  kind: "tyre" | "wheel";
  label: string;        // what to call it on the page
  width?: string; profile?: string; rim?: string; pcd?: string;
  brand?: string;       // a brand we stock
}

const BRAND_ALIASES: Record<string, string> = { bfg: "bfgoodrich", "bf-goodrich": "bfgoodrich" };

/** What the old product was (tyre size / wheel rim + PCD / brand), read from
 *  its title, or from the words in an old link. Null if it says nothing useful. */
export async function wantedFrom(text: string, title?: string): Promise<Wanted | null> {
  const t = (title ?? text.replace(/-/g, " ")).toUpperCase();
  const flat = text.toUpperCase();
  const brands = await getBrandDirectory();
  const first = t.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const bSlug = BRAND_ALIASES[first] ?? first;
  const brand = brands.find((b) => b.count > 0 && b.slug === bSlug && b.slug !== "tyre-mall")?.name;

  const wheel = /\bMAGS?\b|\d{2}\s*INCH|\bWHEELS?\b|\bRIMS?\b/.test(t);
  if (wheel) {
    const rim = (t.match(/\b(1[3-9]|2[0-4])\s*(?:INCH|")/) ?? t.match(/\b(1[3-9]|2[0-4])X\d/))?.[1];
    const pcdM = t.match(/\b([4-8])\s*X\s*(\d{3}(?:\.\d)?)\b/);
    return { kind: "wheel", label: title ?? "this mag wheel", rim, pcd: pcdM ? `${pcdM[1]}x${pcdM[2]}` : undefined, brand };
  }
  // Tyre size from a title ("225/55YR16", "195R15C") or a link ("225-55yr16").
  const src = title ? t : flat;
  let m = src.match(/(\d{3})[/-](\d{2})\s*(?:[A-Z]{1,2})?R\s?(\d{2}(?:\.5)?)/);
  if (m) return { kind: "tyre", label: title ?? `${m[1]}/${m[2]} R${m[3]} tyre`, width: m[1], profile: m[2], rim: m[3], brand };
  m = src.match(/\b(\d{3})\s*R\s?(\d{2})C?\b/);
  if (m) return { kind: "tyre", label: title ?? `${m[1]} R${m[2]} tyre`, width: m[1], rim: m[2], brand };
  if (brand) return { kind: "tyre", label: title ?? `${brand} tyre`, brand };
  return null;
}

const num = (v?: string) => String(v ?? "").replace(",", ".").replace(/[^0-9.]/g, "");

/** Up to `limit` products we sell that are closest to what was wanted:
 *  same size / rim (+ PCD for wheels), in stock and with a photo first, the
 *  same brand first. Tops up with current deals so the page is never empty. */
export async function similarFor(w: Wanted | null, limit = 8): Promise<{ items: Product[]; exact: boolean }> {
  const all = (await getProducts()).filter((p) => p.price > 0);
  let pool: Product[] = [];
  if (w?.kind === "wheel") {
    const wheels = all.filter((p) => p.type === "wheel");
    const byRim = w.rim ? wheels.filter((p) => num(p.specs.rim) === w.rim) : [];
    const byPcd = w.pcd ? byRim.filter((p) => String(p.specs.pcd ?? "").toLowerCase().split("|").some((x) => x.replace(/\s/g, "") === w.pcd)) : [];
    pool = byPcd.length >= 2 ? byPcd : byRim.length ? byRim : wheels;
  } else if (w) {
    const tyres = all.filter((p) => p.type === "tyre");
    const sameSize = w.width && w.rim
      ? tyres.filter((p) => p.specs.width === w.width && num(p.specs.rim) === w.rim && (w.profile ? p.specs.profile === w.profile : !p.specs.profile))
      : [];
    pool = sameSize.length ? sameSize : w.brand ? tyres.filter((p) => p.brand === w.brand) : [];
  }
  const exact = pool.length > 0;
  const rank = (p: Product) => (p.inStock ? 0 : 4) + (p.image ? 0 : 2) + (w?.brand && p.brand === w.brand ? 0 : 1);
  let items = [...pool].sort((a, b) => rank(a) - rank(b) || a.price - b.price).slice(0, limit);
  if (items.length < 4) {
    const deals = (await dealProducts(40)).filter((d) => d.inStock && d.image && (!w || d.type === w.kind) && !items.some((i) => i.id === d.id));
    items = [...items, ...deals].slice(0, Math.max(4, Math.min(limit, items.length + deals.length)));
  }
  return { items, exact };
}
