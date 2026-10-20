import "server-only";
import { and, or, like, eq, sql, inArray } from "drizzle-orm";
import { db, schema, libsql } from "./index";
import productsData from "@/data/products.json";
import { revalidateProducts } from "../catalogue-cache";

type Snap = {
  id: number; slug: string; name: string; brand?: string; type?: string; sku?: string;
  price?: number; regularPrice?: number; salePrice?: number; onSale?: boolean;
  image?: string | null; categories?: unknown; specs?: unknown;
  shortDescription?: string; description?: string; inStock?: boolean; stockQty?: number | null;
};
const SNAP = productsData as unknown as Snap[];

// Build DB-row-shaped records from the snapshot. The snapshot's own `id` is NOT
// reliably unique (newly-added catalogue rows share id 0), but every `slug` is
// unique and the app only ever looks products up by slug/sku — so we assign a
// synthetic unique id to any row with a missing/duplicate id to satisfy the
// PRIMARY KEY, without changing any lookup behaviour.
function rowsFromSnapshot(updatedAt: number) {
  const used = new Set<number>();
  let nextId = SNAP.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
  return SNAP.map((p) => {
    let id = p.id || 0;
    if (!id || used.has(id)) id = nextId++;
    used.add(id);
    return {
      id, slug: p.slug, name: p.name, brand: p.brand ?? "", type: p.type ?? "tyre", sku: p.sku ?? "",
      price: p.price ?? 0, regularPrice: p.regularPrice ?? 0, salePrice: p.salePrice ?? p.price ?? 0, onSale: !!p.onSale,
      stockQty: p.stockQty ?? (p.inStock ? 10 : 0), lowStockThreshold: 4, image: p.image ?? null,
      categories: JSON.stringify(p.categories ?? []), specs: JSON.stringify(p.specs ?? {}),
      shortDescription: p.shortDescription ?? "", description: p.description ?? "", visible: true, updatedAt,
    };
  });
}

// Create the products table (if missing) and seed it from the committed
// snapshot when empty — so the admin works on a fresh/persistent DB (0724) and
// doesn't crash on an empty in-memory DB (e.g. Vercel). Runs once per process.
let seeded = false;
async function ensureProducts(): Promise<void> {
  if (seeded) return;
  try {
    await libsql.execute(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'tyre', sku TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0, regular_price INTEGER NOT NULL DEFAULT 0, sale_price INTEGER NOT NULL DEFAULT 0,
      on_sale INTEGER NOT NULL DEFAULT 0, stock_qty INTEGER NOT NULL DEFAULT 0, low_stock_threshold INTEGER NOT NULL DEFAULT 4,
      image TEXT, categories TEXT NOT NULL DEFAULT '[]', specs TEXT NOT NULL DEFAULT '{}',
      short_description TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL DEFAULT 0)`);
    const cnt = await db.select({ c: sql<number>`count(*)` }).from(schema.products);
    if (Number(cnt[0].c) === 0 && SNAP.length) {
      const rows = rowsFromSnapshot(Date.now());
      for (let i = 0; i < rows.length; i += 400) {
        await db.insert(schema.products).values(rows.slice(i, i + 400));
      }
    }
    seeded = true;
  } catch (e) {
    console.error("[db] ensureProducts failed:", (e as Error).message);
  }
}

// Snapshot shaped like a product DB row, for read fallbacks.
function snapRows() {
  return rowsFromSnapshot(0);
}

export interface LiveInfo {
  inStock: boolean;
  lowStockRemaining: number | null;
  price: number;
  regularPrice: number;
  salePrice: number;
  onSale: boolean;
}

/** Live stock + price for the storefront (our DB is the source of truth).
 *  Returns null on any DB error so callers fall back to the static snapshot. */
export async function getLive(slug: string): Promise<LiveInfo | null> {
  let r;
  try {
    const rows = await db
      .select({
        price: schema.products.price,
        regularPrice: schema.products.regularPrice,
        salePrice: schema.products.salePrice,
        onSale: schema.products.onSale,
        stockQty: schema.products.stockQty,
        lowStockThreshold: schema.products.lowStockThreshold,
      })
      .from(schema.products)
      .where(eq(schema.products.slug, slug))
      .limit(1);
    r = rows[0];
  } catch (e) {
    console.warn("[db] getLive fallback:", (e as Error).message);
    return null;
  }
  if (!r) return null;
  const inStock = r.stockQty > 0;
  return {
    inStock,
    lowStockRemaining: inStock && r.stockQty <= r.lowStockThreshold ? r.stockQty : null,
    price: r.price,
    regularPrice: r.regularPrice,
    salePrice: r.salePrice,
    onSale: r.onSale,
  };
}

/** Decrement stock when an order is paid. Never goes below zero. */
export async function decrementStock(slug: string, qty: number): Promise<void> {
  try {
    await db
      .update(schema.products)
      .set({ stockQty: sql`MAX(0, ${schema.products.stockQty} - ${qty})`, updatedAt: Date.now() })
      .where(eq(schema.products.slug, slug));
    // Product pages are static (prerendered); revalidate so the new stock shows.
    revalidateProducts();
  } catch (e) {
    console.error("[db] decrementStock failed", slug, (e as Error).message);
  }
}

/** Add stock back (e.g. when an order is cancelled or refunded). */
export async function incrementStock(slug: string, qty: number): Promise<void> {
  try {
    await db
      .update(schema.products)
      .set({ stockQty: sql`${schema.products.stockQty} + ${qty}`, updatedAt: Date.now() })
      .where(eq(schema.products.slug, slug));
    // Product pages are static (prerendered); revalidate so the new stock shows.
    revalidateProducts();
  } catch (e) {
    console.error("[db] incrementStock failed", slug, (e as Error).message);
  }
}

// ---- admin ------------------------------------------------------------------
export type AdminFilter = "all" | "low" | "out" | "sale";

/** The admin product filter, shared by the list and "apply to all matching"
 *  bulk edits so both always act on exactly the same products. Search covers
 *  name, SKU, brand, category, size/specs and slug — and "265/65R17"-style
 *  sizes typed with or without the slash / R. */
function productWhere(opts: { q?: string; filter?: AdminFilter; type?: string }) {
  const conds = [];
  if (opts.q?.trim()) {
    const t = `%${opts.q.trim()}%`;
    const compact = `%${opts.q.replace(/[\s/r-]/gi, "")}%`;
    conds.push(or(
      like(schema.products.name, t), like(schema.products.sku, t), like(schema.products.brand, t),
      like(schema.products.categories, t), like(schema.products.specs, t), like(schema.products.slug, t),
      sql`REPLACE(REPLACE(REPLACE(UPPER(${schema.products.name}), '/', ''), ' ', ''), 'R', '') LIKE UPPER(${compact})`,
    ));
  }
  if (opts.type === "other") conds.push(sql`${schema.products.type} NOT IN ('tyre', 'wheel')`);
  else if (opts.type) conds.push(eq(schema.products.type, opts.type));
  if (opts.filter === "low") conds.push(sql`stock_qty > 0 AND stock_qty <= low_stock_threshold`);
  if (opts.filter === "out") conds.push(sql`stock_qty = 0`);
  if (opts.filter === "sale") conds.push(eq(schema.products.onSale, true));
  return conds.length ? and(...conds) : undefined;
}

export async function listProducts(opts: { q?: string; page?: number; perPage?: number; filter?: AdminFilter; type?: string }) {
  await ensureProducts();
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 30;
  try {
    const where = productWhere(opts);

    const rows = await db.select().from(schema.products).where(where)
      .orderBy(schema.products.name).limit(perPage).offset((page - 1) * perPage);
    const totalRow = await db.select({ c: sql<number>`count(*)` }).from(schema.products).where(where);
    return { rows, total: Number(totalRow[0].c), page, perPage };
  } catch (e) {
    console.error("[db] listProducts fallback to snapshot:", (e as Error).message);
    // Snapshot fallback so the admin still lists the catalogue if the DB is unavailable.
    const q = (opts.q || "").toLowerCase();
    let rows = snapRows();
    if (opts.type === "other") rows = rows.filter((r) => r.type !== "tyre" && r.type !== "wheel");
    else if (opts.type) rows = rows.filter((r) => r.type === opts.type);
    if (q) rows = rows.filter((r) => `${r.name} ${r.sku} ${r.brand} ${r.categories} ${r.specs} ${r.slug}`.toLowerCase().includes(q));
    if (opts.filter === "low") rows = rows.filter((r) => r.stockQty > 0 && r.stockQty <= r.lowStockThreshold);
    if (opts.filter === "out") rows = rows.filter((r) => r.stockQty === 0);
    if (opts.filter === "sale") rows = rows.filter((r) => r.onSale);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const total = rows.length;
    const paged = rows.slice((page - 1) * perPage, (page - 1) * perPage + perPage);
    return { rows: paged, total, page, perPage };
  }
}

/** Product counts for the admin type tabs (Tyres / Wheels & rims / Other). */
export async function productTypeCounts(): Promise<{ tyre: number; wheel: number; other: number; all: number }> {
  await ensureProducts();
  try {
    const r = await libsql.execute("SELECT type, COUNT(*) n FROM products GROUP BY type");
    const out = { tyre: 0, wheel: 0, other: 0, all: 0 };
    for (const row of r.rows) {
      const n = Number(row.n);
      const t = String(row.type);
      if (t === "tyre") out.tyre += n; else if (t === "wheel") out.wheel += n; else out.other += n;
      out.all += n;
    }
    return out;
  } catch {
    const rows = snapRows();
    const tyre = rows.filter((r) => r.type === "tyre").length, wheel = rows.filter((r) => r.type === "wheel").length;
    return { tyre, wheel, other: rows.length - tyre - wheel, all: rows.length };
  }
}

export async function getProductRow(slug: string) {
  await ensureProducts();
  try {
    const rows = await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.error("[db] getProductRow fallback to snapshot:", (e as Error).message);
    return snapRows().find((r) => r.slug === slug) ?? null;
  }
}

export interface ProductPatch {
  price?: number;
  regularPrice?: number;
  salePrice?: number;
  onSale?: boolean;
  stockQty?: number;
  lowStockThreshold?: number;
  visible?: boolean;
  name?: string;
  brand?: string;
  type?: string;
  sku?: string;
  image?: string | null;
  categories?: string; // json string
  specs?: string; // json string
  description?: string;
  shortDescription?: string;
}

export async function updateProductFields(slug: string, patch: ProductPatch): Promise<void> {
  await db.update(schema.products).set({ ...patch, updatedAt: Date.now() }).where(eq(schema.products.slug, slug));
  revalidateProducts();
}

export async function getAllProducts() {
  await ensureProducts();
  try {
    return await db.select().from(schema.products).orderBy(schema.products.name);
  } catch (e) {
    console.error("[db] getAllProducts fallback to snapshot:", (e as Error).message);
    return snapRows().sort((a, b) => a.name.localeCompare(b.name));
  }
}

export interface NewProduct {
  slug: string;
  name: string;
  brand?: string;
  type?: string;
  sku?: string;
  regularPrice: number;
  salePrice?: number;
  onSale?: boolean;
  stockQty?: number;
  lowStockThreshold?: number;
  image?: string | null;
  categories?: string[];
  specs?: Record<string, string>;
  shortDescription?: string;
  description?: string;
  visible?: boolean;
}

export async function createProduct(p: NewProduct): Promise<{ ok: boolean; error?: string }> {
  const existing = await getProductRow(p.slug);
  if (existing) return { ok: false, error: "A product with that slug already exists." };
  const id = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);
  const onSale = !!p.onSale && (p.salePrice ?? 0) > 0 && (p.salePrice ?? 0) < p.regularPrice;
  await db.insert(schema.products).values({
    id,
    slug: p.slug,
    name: p.name,
    brand: p.brand ?? "",
    type: p.type ?? "tyre",
    sku: p.sku ?? "",
    price: onSale ? (p.salePrice ?? p.regularPrice) : p.regularPrice,
    regularPrice: p.regularPrice,
    salePrice: p.salePrice ?? p.regularPrice,
    onSale,
    stockQty: p.stockQty ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 4,
    image: p.image ?? "/brand/placeholder-tyre.webp",
    categories: JSON.stringify(p.categories ?? []),
    specs: JSON.stringify(p.specs ?? {}),
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    visible: p.visible ?? true,
    updatedAt: Date.now(),
  });
  revalidateProducts();
  return { ok: true };
}

export async function deleteProduct(slug: string): Promise<void> {
  await db.delete(schema.products).where(eq(schema.products.slug, slug));
  revalidateProducts();
}

/** Bulk update price/stock/sale/visibility by slug or SKU. Returns counts. */
export async function bulkUpsert(rows: Record<string, string>[]): Promise<{ updated: number; skipped: number }> {
  let updated = 0, skipped = 0;
  for (const r of rows) {
    const slug = (r.slug || "").trim();
    const sku = (r.sku || "").trim();
    let target = slug ? await getProductRow(slug) : null;
    if (!target && sku) {
      const bySku = await db.select().from(schema.products).where(eq(schema.products.sku, sku)).limit(1);
      target = bySku[0] ?? null;
    }
    if (!target) { skipped++; continue; }
    const patch: ProductPatch = {};
    const n = (v: string) => (v !== undefined && v !== "" && isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : undefined);
    if (r.regular_price !== undefined) patch.price = n(r.regular_price);
    if (r.sale_price !== undefined) patch.salePrice = n(r.sale_price);
    if (r.stock !== undefined) patch.stockQty = n(r.stock);
    if (r.low_stock_threshold !== undefined) patch.lowStockThreshold = n(r.low_stock_threshold);
    if (r.on_sale !== undefined) patch.onSale = /^(1|true|yes)$/i.test(r.on_sale.trim());
    if (r.visible !== undefined) patch.visible = /^(1|true|yes)$/i.test(r.visible.trim());
    if (patch.onSale && patch.salePrice !== undefined) patch.price = patch.salePrice;
    if (patch.onSale === false) patch.price = patch.price ?? target.regularPrice;
    await updateProductFields(target.slug, patch);
    updated++;
  }
  return { updated, skipped };
}

// ---- bulk operations --------------------------------------------------------
export type BulkOp =
  | { kind: "price"; mode: "pct_down" | "pct_up" | "rand_down" | "rand_up" | "set"; value: number; rounding?: "none" | "r99" | "r10" | "r50" }
  | { kind: "stock"; mode: "set" | "inc" | "dec"; value: number }
  | { kind: "status"; visible: boolean }
  | { kind: "sale"; mode: "set" | "remove"; pct?: number };

/** Round a price (minor units) to an SA-friendly ending. */
function roundCents(cents: number, rule: "none" | "r99" | "r10" | "r50" = "none"): number {
  const c = Math.max(0, Math.round(cents));
  if (rule === "none") return c;
  const rand = c / 100;
  if (rule === "r10") return Math.max(0, Math.round(rand / 10) * 10) * 100;
  if (rule === "r50") return Math.max(0, Math.round(rand / 50) * 50) * 100;
  const hundreds = Math.max(1, Math.round(rand / 100)); // r99: nearest hundred, end in 99
  return (hundreds * 100 - 1) * 100;
}

export interface BulkTarget { slug: string; regularPrice: number; salePrice: number; onSale: boolean; stockQty: number; price: number; visible: boolean }

async function bulkTargets(opts: { slugs?: string[]; q?: string; filter?: AdminFilter; type?: string }): Promise<BulkTarget[]> {
  const cols = {
    slug: schema.products.slug,
    regularPrice: schema.products.regularPrice,
    salePrice: schema.products.salePrice,
    onSale: schema.products.onSale,
    stockQty: schema.products.stockQty,
    price: schema.products.price,
    visible: schema.products.visible,
  };
  if (opts.slugs?.length) {
    const out: BulkTarget[] = [];
    for (let i = 0; i < opts.slugs.length; i += 300) {
      const rows = await db.select(cols).from(schema.products).where(inArray(schema.products.slug, opts.slugs.slice(i, i + 300)));
      out.push(...rows);
    }
    return out;
  }
  const where = productWhere(opts);
  return db.select(cols).from(schema.products).where(where);
}

function computePatch(t: BulkTarget, op: BulkOp) {
  if (op.kind === "price") {
    let reg = t.regularPrice;
    if (op.mode === "pct_down") reg = t.regularPrice * (1 - op.value / 100);
    else if (op.mode === "pct_up") reg = t.regularPrice * (1 + op.value / 100);
    else if (op.mode === "rand_down") reg = t.regularPrice - op.value * 100;
    else if (op.mode === "rand_up") reg = t.regularPrice + op.value * 100;
    else reg = op.value * 100; // set
    reg = roundCents(reg, op.rounding);
    const keepSale = t.onSale && t.salePrice > 0 && t.salePrice < reg;
    return { regularPrice: reg, onSale: keepSale, salePrice: keepSale ? t.salePrice : reg, price: keepSale ? t.salePrice : reg };
  }
  if (op.kind === "stock") {
    const q = op.mode === "set" ? op.value : op.mode === "inc" ? t.stockQty + op.value : t.stockQty - op.value;
    return { stockQty: Math.max(0, Math.round(q)) };
  }
  if (op.kind === "status") return { visible: op.visible };
  if (op.mode === "remove") return { onSale: false, salePrice: t.regularPrice, price: t.regularPrice };
  const pct = Math.max(0, Math.min(95, op.pct ?? 0));
  const sale = roundCents(t.regularPrice * (1 - pct / 100), "none");
  return { onSale: true, salePrice: sale, price: sale };
}

/** Apply a bulk operation to selected slugs OR to every product matching a
 *  search/filter. Returns how many rows were updated. */
export async function bulkUpdateProducts(opts: { slugs?: string[]; q?: string; filter?: AdminFilter; type?: string; op: BulkOp }): Promise<{ updated: number; before: BulkTarget[] }> {
  await ensureProducts();
  const targets = await bulkTargets(opts);
  if (!targets.length) return { updated: 0, before: [] };
  const now = Date.now();
  const stmts = targets.map((t) => {
    const p = computePatch(t, opts.op) as unknown as Record<string, number | boolean>;
    const sets = ["updated_at = ?"];
    const args: (number | string)[] = [now];
    const col: Record<string, string> = { regularPrice: "regular_price", salePrice: "sale_price", price: "price", onSale: "on_sale", stockQty: "stock_qty", visible: "visible" };
    for (const [k, v] of Object.entries(p)) {
      sets.push(`${col[k]} = ?`);
      args.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
    }
    args.push(t.slug);
    return { sql: `UPDATE products SET ${sets.join(", ")} WHERE slug = ?`, args };
  });
  for (let i = 0; i < stmts.length; i += 200) {
    await libsql.batch(stmts.slice(i, i + 200));
  }
  revalidateProducts();
  return { updated: targets.length, before: targets };
}

/** Put products back to earlier values (Undo for bulk edits). */
export async function restoreProducts(items: BulkTarget[]): Promise<number> {
  await ensureProducts();
  const now = Date.now();
  const stmts = items.filter((t) => t && typeof t.slug === "string").map((t) => ({
    sql: `UPDATE products SET regular_price = ?, sale_price = ?, on_sale = ?, price = ?, stock_qty = ?, visible = ?, updated_at = ? WHERE slug = ?`,
    args: [
      Math.round(Number(t.regularPrice) || 0), Math.round(Number(t.salePrice) || 0), t.onSale ? 1 : 0,
      Math.round(Number(t.price) || 0), Math.max(0, Math.round(Number(t.stockQty) || 0)), t.visible ? 1 : 0, now, t.slug,
    ],
  }));
  for (let i = 0; i < stmts.length; i += 200) await libsql.batch(stmts.slice(i, i + 200));
  revalidateProducts();
  return stmts.length;
}

export async function dashboardStats() {
  await ensureProducts();
  try {
    const [tot, inStock, low, out, onSale] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(schema.products),
      db.select({ c: sql<number>`count(*)` }).from(schema.products).where(sql`stock_qty > 0`),
      db.select({ c: sql<number>`count(*)` }).from(schema.products).where(sql`stock_qty > 0 AND stock_qty <= low_stock_threshold`),
      db.select({ c: sql<number>`count(*)` }).from(schema.products).where(sql`stock_qty = 0`),
      db.select({ c: sql<number>`count(*)` }).from(schema.products).where(eq(schema.products.onSale, true)),
    ]);
    return {
      total: Number(tot[0].c),
      inStock: Number(inStock[0].c),
      low: Number(low[0].c),
      out: Number(out[0].c),
      onSale: Number(onSale[0].c),
    };
  } catch (e) {
    console.error("[db] dashboardStats fallback to snapshot:", (e as Error).message);
    const rows = snapRows();
    return {
      total: rows.length,
      inStock: rows.filter((r) => r.stockQty > 0).length,
      low: rows.filter((r) => r.stockQty > 0 && r.stockQty <= r.lowStockThreshold).length,
      out: rows.filter((r) => r.stockQty === 0).length,
      onSale: rows.filter((r) => r.onSale).length,
    };
  }
}
