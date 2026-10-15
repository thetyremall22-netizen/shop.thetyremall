import "server-only";
import { and, or, like, eq, sql } from "drizzle-orm";
import { db, schema, libsql } from "./index";
import productsData from "@/data/products.json";

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
  } catch (e) {
    console.error("[db] incrementStock failed", slug, (e as Error).message);
  }
}

// ---- admin ------------------------------------------------------------------
export type AdminFilter = "all" | "low" | "out" | "sale";

export async function listProducts(opts: { q?: string; page?: number; perPage?: number; filter?: AdminFilter; type?: string }) {
  await ensureProducts();
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 30;
  try {
    const conds = [];
    if (opts.q) {
      const t = `%${opts.q}%`;
      conds.push(or(like(schema.products.name, t), like(schema.products.sku, t), like(schema.products.brand, t)));
    }
    if (opts.type) conds.push(eq(schema.products.type, opts.type));
    if (opts.filter === "low") conds.push(sql`stock_qty > 0 AND stock_qty <= low_stock_threshold`);
    if (opts.filter === "out") conds.push(sql`stock_qty = 0`);
    if (opts.filter === "sale") conds.push(eq(schema.products.onSale, true));
    const where = conds.length ? and(...conds) : undefined;

    const rows = await db.select().from(schema.products).where(where)
      .orderBy(schema.products.name).limit(perPage).offset((page - 1) * perPage);
    const totalRow = await db.select({ c: sql<number>`count(*)` }).from(schema.products).where(where);
    return { rows, total: Number(totalRow[0].c), page, perPage };
  } catch (e) {
    console.error("[db] listProducts fallback to snapshot:", (e as Error).message);
    // Snapshot fallback so the admin still lists the catalogue if the DB is unavailable.
    const q = (opts.q || "").toLowerCase();
    let rows = snapRows();
    if (opts.type) rows = rows.filter((r) => r.type === opts.type);
    if (q) rows = rows.filter((r) => `${r.name} ${r.sku} ${r.brand}`.toLowerCase().includes(q));
    if (opts.filter === "low") rows = rows.filter((r) => r.stockQty > 0 && r.stockQty <= r.lowStockThreshold);
    if (opts.filter === "out") rows = rows.filter((r) => r.stockQty === 0);
    if (opts.filter === "sale") rows = rows.filter((r) => r.onSale);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const total = rows.length;
    const paged = rows.slice((page - 1) * perPage, (page - 1) * perPage + perPage);
    return { rows: paged, total, page, perPage };
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
  salePrice?: number;
  onSale?: boolean;
  stockQty?: number;
  lowStockThreshold?: number;
  visible?: boolean;
  name?: string;
  description?: string;
  shortDescription?: string;
}

export async function updateProductFields(slug: string, patch: ProductPatch): Promise<void> {
  await db.update(schema.products).set({ ...patch, updatedAt: Date.now() }).where(eq(schema.products.slug, slug));
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
  return { ok: true };
}

export async function deleteProduct(slug: string): Promise<void> {
  await db.delete(schema.products).where(eq(schema.products.slug, slug));
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
