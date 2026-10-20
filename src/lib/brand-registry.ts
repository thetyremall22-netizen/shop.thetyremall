import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";
import { PRODUCTS_TAG, revalidateProducts } from "./catalogue-cache";
import { brandSlug, hasBrandLogo, brandLogoPath } from "./brands";

// Live brand list. Every brand that has products in the shop shows up
// automatically (added in Admin, by CSV import, anywhere), plus brands added in
// Admin → Products → Brands before their products arrive. Logos come from the
// upload in Admin, else the built-in logo files, else the brand name as text.

export interface BrandInfo {
  name: string;
  slug: string;
  count: number;        // visible products
  logo: string | null;  // image URL to show, if any
  uploadedLogo: string; // logo set in Admin (may be "")
  showInMenu: boolean;
  registered: boolean;  // has an Admin record (logo / settings)
}

export const BRANDS_TAG = "brands";
// Not tyre brands for the brand wall / menu: A-Line is wheels, "Tyre Mall" is our house label.
const NOT_TYRE_BRANDS = new Set(["a-line", "tyre-mall"]);

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS brands (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT NOT NULL DEFAULT '',
    show_in_menu INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  ensured = true;
}

async function readBrands(): Promise<BrandInfo[]> {
  try {
    await ensureTable();
    const counts = await libsql.execute(`SELECT brand, COUNT(*) n FROM products WHERE visible = 1 AND TRIM(brand) <> '' GROUP BY brand`).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const reg = await libsql.execute("SELECT * FROM brands");
    const bySlug = new Map<string, BrandInfo>();
    for (const r of counts.rows as Record<string, unknown>[]) {
      const name = String(r.brand).trim();
      const slug = brandSlug(name);
      const prev = bySlug.get(slug);
      bySlug.set(slug, { name: prev?.name ?? name, slug, count: (prev?.count ?? 0) + Number(r.n), logo: null, uploadedLogo: "", showInMenu: true, registered: false });
    }
    for (const r of reg.rows as Record<string, unknown>[]) {
      const slug = String(r.slug);
      const b = bySlug.get(slug) ?? { name: String(r.name), slug, count: 0, logo: null, uploadedLogo: "", showInMenu: true, registered: true };
      b.name = String(r.name) || b.name;
      b.uploadedLogo = String(r.logo ?? "");
      b.showInMenu = Number(r.show_in_menu) === 1;
      b.registered = true;
      bySlug.set(slug, b);
    }
    for (const b of bySlug.values()) b.logo = b.uploadedLogo || (hasBrandLogo(b.name) ? brandLogoPath(b.name) : null);
    return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  } catch (e) {
    console.error("[brands] read failed:", (e as Error).message);
    return [];
  }
}

/** Cached for the storefront; refreshed when products or brands change. */
export async function getBrandDirectory(): Promise<BrandInfo[]> {
  "use cache";
  cacheTag(BRANDS_TAG);
  cacheTag(PRODUCTS_TAG);
  cacheLife("hours");
  return readBrands();
}

/** Brands for the menu and home brand wall (tyre brands with products). */
export async function menuBrands(): Promise<{ name: string; logo: string | null }[]> {
  return (await getBrandDirectory())
    .filter((b) => b.count > 0 && b.showInMenu && !NOT_TYRE_BRANDS.has(b.slug))
    .map((b) => ({ name: b.name, logo: b.logo }));
}

/** Brands with product counts, for the shop filters. */
export async function filterBrands(): Promise<{ name: string; count: number }[]> {
  return (await getBrandDirectory()).filter((b) => b.count > 0).map((b) => ({ name: b.name, count: b.count }));
}

/** Logo URL per brand name, for product cards. */
export async function brandLogoMap(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const b of await getBrandDirectory()) if (b.logo) out[b.slug] = b.logo;
  return out;
}

export const listBrandsAdmin = readBrands;

function bump() {
  try { revalidateTag(BRANDS_TAG, "max"); } catch { /* outside a request */ }
}

export async function saveBrand(input: { name: string; logo?: string; showInMenu?: boolean }): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await ensureTable();
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60);
  const slug = brandSlug(name);
  if (!slug) return { ok: false, error: "Enter a brand name." };
  const now = Date.now();
  await libsql.execute({
    sql: `INSERT INTO brands (slug, name, logo, show_in_menu, created_at, updated_at) VALUES (?,?,?,?,?,?)
          ON CONFLICT(slug) DO UPDATE SET name = excluded.name, logo = excluded.logo, show_in_menu = excluded.show_in_menu, updated_at = excluded.updated_at`,
    args: [slug, name, input.logo ?? "", input.showInMenu === false ? 0 : 1, now, now],
  });
  bump();
  return { ok: true, slug };
}

/** Set a logo only if the brand doesn't have one yet (used by CSV import). */
export async function setBrandLogoIfMissing(name: string, logo: string): Promise<void> {
  await ensureTable();
  const slug = brandSlug(name);
  if (!slug || !logo) return;
  const now = Date.now();
  await libsql.execute({
    sql: `INSERT INTO brands (slug, name, logo, show_in_menu, created_at, updated_at) VALUES (?,?,?,1,?,?)
          ON CONFLICT(slug) DO UPDATE SET logo = CASE WHEN brands.logo = '' THEN excluded.logo ELSE brands.logo END, updated_at = excluded.updated_at`,
    args: [slug, name.trim(), logo, now, now],
  });
  bump();
}

/** Rename a brand everywhere (its products too). */
export async function renameBrand(fromSlug: string, toName: string): Promise<{ ok: true; products: number } | { ok: false; error: string }> {
  await ensureTable();
  const name = toName.trim().replace(/\s+/g, " ").slice(0, 60);
  const toSlug = brandSlug(name);
  if (!toSlug) return { ok: false, error: "Enter a brand name." };
  const all = await readBrands();
  const from = all.find((b) => b.slug === fromSlug);
  if (!from) return { ok: false, error: "Brand not found." };
  if (toSlug !== fromSlug && all.some((b) => b.slug === toSlug)) return { ok: false, error: `“${name}” already exists. Rename products into it with a CSV, or choose another name.` };
  const r = await libsql.execute(`SELECT slug, brand FROM products`);
  const targets = (r.rows as Record<string, unknown>[]).filter((x) => brandSlug(String(x.brand)) === fromSlug).map((x) => String(x.slug));
  const now = Date.now();
  for (let i = 0; i < targets.length; i += 300) {
    const chunk = targets.slice(i, i + 300);
    await libsql.execute({ sql: `UPDATE products SET brand = ?, updated_at = ? WHERE slug IN (${chunk.map(() => "?").join(",")})`, args: [name, now, ...chunk] });
  }
  const reg = await libsql.execute({ sql: "SELECT * FROM brands WHERE slug = ?", args: [fromSlug] });
  if (toSlug !== fromSlug) await libsql.execute({ sql: "DELETE FROM brands WHERE slug = ?", args: [fromSlug] });
  const row = reg.rows[0] as Record<string, unknown> | undefined;
  await saveBrand({ name, logo: row ? String(row.logo ?? "") : "", showInMenu: row ? Number(row.show_in_menu) === 1 : true });
  revalidateProducts();
  return { ok: true, products: targets.length };
}

/** Remove a brand's Admin record (only when it has no products). */
export async function deleteBrand(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureTable();
  const b = (await readBrands()).find((x) => x.slug === slug);
  if (!b) return { ok: false, error: "Brand not found." };
  if (b.count > 0) return { ok: false, error: `${b.name} still has ${b.count} product(s). Move or delete them first, or hide the brand from the menu instead.` };
  await libsql.execute({ sql: "DELETE FROM brands WHERE slug = ?", args: [slug] });
  bump();
  return { ok: true };
}
