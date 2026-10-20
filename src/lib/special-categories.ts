import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";
import { categories as STATIC_CATEGORIES, getCategory } from "./catalogue";
import { revalidateProducts } from "./catalogue-cache";
import type { Category } from "./types";

// Special (seasonal) categories — e.g. "Father's Day Specials", "Christmas
// Deals". Created in Admin → Products → Special categories with an optional
// start and end date. Products are tagged with the category's slug (the same
// way as every other category), so the shop, filters and the
// /product-category/<slug> page work for them automatically. Outside its dates
// a special is hidden from the site.

export type SpecialKind = "special" | "sale";

export interface SpecialCategory {
  id: number;
  /** "special" (seasonal, e.g. Father's Day) or "sale" (e.g. Black Friday Sale). */
  kind: SpecialKind;
  slug: string;
  name: string;
  description: string;
  image: string;
  startAt: number | null;
  endAt: number | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type SpecialStatus = "draft" | "scheduled" | "live" | "ended";

export function specialStatus(c: SpecialCategory, now = Date.now()): SpecialStatus {
  if (!c.enabled) return "draft";
  if (c.startAt && now < c.startAt) return "scheduled";
  if (c.endAt && now > c.endAt) return "ended";
  return "live";
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS special_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    start_at INTEGER,
    end_at INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  try { await libsql.execute("ALTER TABLE special_categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'special'"); } catch { /* already there */ }
  ensured = true;
}

function toSpecial(r: Record<string, unknown>): SpecialCategory {
  return {
    id: Number(r.id), kind: String(r.kind ?? "special") === "sale" ? "sale" : "special", slug: String(r.slug), name: String(r.name), description: String(r.description ?? ""),
    image: String(r.image ?? ""), startAt: r.start_at == null ? null : Number(r.start_at), endAt: r.end_at == null ? null : Number(r.end_at),
    enabled: Number(r.enabled) === 1, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
  };
}

export async function listSpecials(kind?: SpecialKind): Promise<SpecialCategory[]> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT * FROM special_categories ORDER BY COALESCE(start_at, created_at) DESC");
    const all = (r.rows as Record<string, unknown>[]).map(toSpecial);
    return kind ? all.filter((s) => s.kind === kind) : all;
  } catch { return []; }
}

export async function getSpecial(id: number): Promise<SpecialCategory | null> {
  await ensureTable();
  const r = await libsql.execute({ sql: "SELECT * FROM special_categories WHERE id = ?", args: [id] });
  return r.rows.length ? toSpecial(r.rows[0] as Record<string, unknown>) : null;
}

async function getSpecialBySlug(slug: string): Promise<SpecialCategory | null> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM special_categories WHERE slug = ?", args: [slug] });
    return r.rows.length ? toSpecial(r.rows[0] as Record<string, unknown>) : null;
  } catch { return null; }
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

export const SPECIALS_TAG = "special-categories";

/** Slugs of the specials/sales live right now. Cached (refreshed every few
 *  minutes, and at once when one is edited) so pre-built pages like the home
 *  page can use it — and a special appears/disappears within minutes of its
 *  start/end time. */
export async function liveSpecialSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(SPECIALS_TAG);
  cacheLife("minutes");
  const now = Date.now();
  return (await listSpecials()).filter((c) => specialStatus(c, now) === "live").map((c) => c.slug);
}

function bumpSpecials() {
  try { revalidateTag(SPECIALS_TAG, "max"); } catch { /* outside a request */ }
}

/** Specials showing on the site right now, shaped like normal categories. */
export async function liveSpecialCategories(): Promise<Category[]> {
  const liveSet = new Set(await liveSpecialSlugs());
  const all = await listSpecials();
  const live = all.filter((c) => liveSet.has(c.slug));
  const counts = await specialProductCounts();
  return live.map((c) => ({ id: 100000 + c.id, name: c.name, slug: c.slug, count: counts[c.slug] ?? 0, image: c.image || null, primary: false } as Category));
}

/** A category by slug: the built-in ones, or a special that's live now. */
export async function findCategory(slug: string): Promise<Category | undefined> {
  const builtIn = getCategory(slug);
  if (builtIn) return builtIn;
  if (!(await liveSpecialSlugs()).includes(slug)) return undefined;
  const s = await getSpecialBySlug(slug);
  if (!s) return undefined;
  return { id: 100000 + s.id, name: s.name, slug: s.slug, count: 0, image: s.image || null, primary: false } as Category;
}

/** All categories for the shop filters: built-in + live specials. */
export async function shopCategories(): Promise<Category[]> {
  return [...(await liveSpecialCategories()), ...STATIC_CATEGORIES];
}

// ---- create / edit / delete --------------------------------------------------------

export interface SpecialInput { kind?: SpecialKind; name: string; slug?: string; description?: string; image?: string; startAt?: number | null; endAt?: number | null; enabled?: boolean }

async function slugTaken(slug: string, exceptId?: number): Promise<boolean> {
  if (getCategory(slug)) return true;
  const s = await getSpecialBySlug(slug);
  return !!s && s.id !== exceptId;
}

function validate(i: SpecialInput): string | null {
  if (!i.name.trim()) return "Give the special a name.";
  if (i.startAt && i.endAt && i.endAt <= i.startAt) return "The end date must be after the start date.";
  return null;
}

export async function createSpecial(i: SpecialInput): Promise<{ ok: true; special: SpecialCategory } | { ok: false; error: string }> {
  await ensureTable();
  const err = validate(i);
  if (err) return { ok: false, error: err };
  const slug = slugify(i.slug || i.name);
  if (!slug) return { ok: false, error: "Enter a web address (slug) using letters and numbers." };
  if (await slugTaken(slug)) return { ok: false, error: `The address “${slug}” is already used by another category. Choose a different one.` };
  const now = Date.now();
  const r = await libsql.execute({
    sql: `INSERT INTO special_categories (kind, slug, name, description, image, start_at, end_at, enabled, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [i.kind === "sale" ? "sale" : "special", slug, i.name.trim(), i.description?.trim() ?? "", i.image ?? "", i.startAt ?? null, i.endAt ?? null, i.enabled === false ? 0 : 1, now, now],
  });
  revalidateProducts();
  bumpSpecials();
  return { ok: true, special: (await getSpecial(Number(r.lastInsertRowid)))! };
}

export async function updateSpecial(id: number, i: SpecialInput): Promise<{ ok: true; before: SpecialCategory; special: SpecialCategory } | { ok: false; error: string }> {
  await ensureTable();
  const before = await getSpecial(id);
  if (!before) return { ok: false, error: "Not found." };
  const err = validate(i);
  if (err) return { ok: false, error: err };
  const slug = slugify(i.slug || before.slug);
  if (slug !== before.slug && (await slugTaken(slug, id))) return { ok: false, error: `The address “${slug}” is already used by another category.` };
  await libsql.execute({
    sql: `UPDATE special_categories SET slug = ?, name = ?, description = ?, image = ?, start_at = ?, end_at = ?, enabled = ?, updated_at = ? WHERE id = ?`,
    args: [slug, i.name.trim(), i.description?.trim() ?? "", i.image ?? "", i.startAt ?? null, i.endAt ?? null, i.enabled === false ? 0 : 1, Date.now(), id],
  });
  // Address changed: move the product tags across.
  if (slug !== before.slug) await renameProductTag(before.slug, slug);
  revalidateProducts();
  bumpSpecials();
  return { ok: true, before, special: (await getSpecial(id))! };
}

/** Delete a special and untag all its products. Returns the products it had
 *  (kept in the history). */
export async function deleteSpecial(id: number): Promise<{ special: SpecialCategory; slugs: string[] } | null> {
  const s = await getSpecial(id);
  if (!s) return null;
  const slugs = await productsInSpecial(s.slug);
  await setProductsInSpecial(s.slug, slugs, "remove");
  await libsql.execute({ sql: "DELETE FROM special_categories WHERE id = ?", args: [id] });
  revalidateProducts();
  bumpSpecials();
  return { special: s, slugs };
}

// ---- product membership -----------------------------------------------------------

const likeTag = (slug: string) => `%"${slug.replace(/[%_]/g, "")}"%`;

export async function productsInSpecial(slug: string): Promise<string[]> {
  const r = await libsql.execute({ sql: "SELECT slug FROM products WHERE categories LIKE ?", args: [likeTag(slug)] });
  return (r.rows as Record<string, unknown>[])
    .map((x) => String(x.slug));
}

export async function specialMembers(slug: string): Promise<{ slug: string; name: string; sku: string; price: number; stockQty: number }[]> {
  const r = await libsql.execute({ sql: "SELECT slug, name, sku, price, stock_qty FROM products WHERE categories LIKE ? ORDER BY name", args: [likeTag(slug)] });
  return (r.rows as Record<string, unknown>[]).map((x) => ({ slug: String(x.slug), name: String(x.name), sku: String(x.sku ?? ""), price: Number(x.price), stockQty: Number(x.stock_qty) }));
}

export async function specialProductCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const s of await listSpecials()) {
    const r = await libsql.execute({ sql: "SELECT COUNT(*) n FROM products WHERE categories LIKE ?", args: [likeTag(s.slug)] }).catch(() => null);
    out[s.slug] = r ? Number(r.rows[0].n) : 0;
  }
  return out;
}

/** Add or remove the special's tag on these products. Returns how many changed. */
export async function setProductsInSpecial(tag: string, productSlugs: string[], action: "add" | "remove"): Promise<number> {
  let changed = 0;
  const now = Date.now();
  for (let i = 0; i < productSlugs.length; i += 300) {
    const chunk = productSlugs.slice(i, i + 300);
    const r = await libsql.execute({ sql: `SELECT slug, categories FROM products WHERE slug IN (${chunk.map(() => "?").join(",")})`, args: chunk });
    const stmts = [];
    for (const row of r.rows as Record<string, unknown>[]) {
      let cats: string[] = [];
      try { cats = JSON.parse(String(row.categories || "[]")); } catch { /* bad json → treat as none */ }
      const has = cats.includes(tag);
      if (action === "add" && !has) cats = [...cats, tag];
      else if (action === "remove" && has) cats = cats.filter((c) => c !== tag);
      else continue;
      stmts.push({ sql: "UPDATE products SET categories = ?, updated_at = ? WHERE slug = ?", args: [JSON.stringify(cats), now, String(row.slug)] });
      changed++;
    }
    if (stmts.length) await libsql.batch(stmts);
  }
  if (changed) revalidateProducts();
  return changed;
}

async function renameProductTag(from: string, to: string): Promise<void> {
  const slugs = await productsInSpecial(from);
  await setProductsInSpecial(from, slugs, "remove");
  await setProductsInSpecial(to, slugs, "add");
}
