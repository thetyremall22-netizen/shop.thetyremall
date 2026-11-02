import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { libsql } from "./db";
import { PRODUCTS_TAG } from "./catalogue-cache";

// Deal products: separate products made for one special / sale category by
// that category's own CSV import (e.g. "Dunlop AT25 — Black November", with its
// own SKU, price and stock). The normal shop product is never touched.
// While the special runs they show in the shop, search and the special; once it
// ends (or is switched off) they're hidden everywhere, and their page says the
// deal has ended with a link to the normal product.

// Same value as SPECIALS_TAG in special-categories.ts (not imported from there:
// that module imports the catalogue, which imports this one).
const SPECIALS_TAG = "special-categories";

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS deal_products (
    slug TEXT PRIMARY KEY,
    special_slug TEXT NOT NULL,
    original_slug TEXT,
    created_at INTEGER NOT NULL
  )`);
  ensured = true;
}

export interface DealProductInfo { slug: string; specialSlug: string; specialName: string; originalSlug: string | null; live: boolean }

const LIVE_SQL = `s.enabled = 1 AND (s.start_at IS NULL OR s.start_at <= ?) AND (s.end_at IS NULL OR s.end_at >= ?)`;

/** Deal products whose special isn't running right now (hidden from the shop).
 *  Cached for minutes, like the specials themselves, and refreshed at once when
 *  a special or product changes. */
export async function hiddenDealSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(SPECIALS_TAG, PRODUCTS_TAG);
  cacheLife("minutes");
  try {
    await ensureTable();
    const now = Date.now();
    const r = await libsql.execute({
      sql: `SELECT d.slug FROM deal_products d LEFT JOIN special_categories s ON s.slug = d.special_slug WHERE s.id IS NULL OR NOT (${LIVE_SQL})`,
      args: [now, now],
    });
    return (r.rows as Record<string, unknown>[]).map((x) => String(x.slug));
  } catch { return []; }
}

/** Every deal product (left out of the Google feed and sitemap: they're temporary). */
export async function allDealSlugs(): Promise<Set<string>> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT slug FROM deal_products");
    return new Set((r.rows as Record<string, unknown>[]).map((x) => String(x.slug)));
  } catch { return new Set(); }
}

/** Is this product a deal product? (its special, the normal product, live or not)
 *  Cached for minutes (product pages are prerendered), refreshed when specials change. */
export async function dealProductInfo(slug: string): Promise<DealProductInfo | null> {
  "use cache";
  cacheTag(SPECIALS_TAG, PRODUCTS_TAG);
  cacheLife("minutes");
  try {
    await ensureTable();
    const now = Date.now();
    const r = await libsql.execute({
      sql: `SELECT d.slug, d.special_slug, d.original_slug, s.name, CASE WHEN s.id IS NOT NULL AND ${LIVE_SQL} THEN 1 ELSE 0 END AS live
            FROM deal_products d LEFT JOIN special_categories s ON s.slug = d.special_slug WHERE d.slug = ? LIMIT 1`,
      args: [now, now, slug],
    });
    if (!r.rows.length) return null;
    const x = r.rows[0] as Record<string, unknown>;
    return { slug: String(x.slug), specialSlug: String(x.special_slug), specialName: String(x.name ?? x.special_slug), originalSlug: x.original_slug ? String(x.original_slug) : null, live: Number(x.live) === 1 };
  } catch { return null; }
}

/** Deal products of one special, by SKU (for re-imports into the same special). */
export async function dealProductsOf(specialSlug: string): Promise<Map<string, { slug: string; sku: string }>> {
  await ensureTable();
  const r = await libsql.execute({ sql: "SELECT p.slug, p.sku FROM deal_products d JOIN products p ON p.slug = d.slug WHERE d.special_slug = ?", args: [specialSlug] });
  return new Map((r.rows as Record<string, unknown>[]).map((x) => [String(x.sku), { slug: String(x.slug), sku: String(x.sku) }]));
}

export async function registerDealProduct(slug: string, specialSlug: string, originalSlug: string | null): Promise<void> {
  await ensureTable();
  await libsql.execute({
    sql: "INSERT INTO deal_products (slug, special_slug, original_slug, created_at) VALUES (?,?,?,?) ON CONFLICT(slug) DO UPDATE SET special_slug = excluded.special_slug, original_slug = excluded.original_slug",
    args: [slug, specialSlug, originalSlug, Date.now()],
  });
}

/** Forget deal products whose product row is gone (after an undo or delete). */
export async function pruneDealProducts(): Promise<void> {
  await ensureTable();
  await libsql.execute("DELETE FROM deal_products WHERE slug NOT IN (SELECT slug FROM products)");
}
