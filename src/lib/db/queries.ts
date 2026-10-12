import "server-only";
import { and, or, like, eq, sql } from "drizzle-orm";
import { db, schema } from "./index";

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
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 30;
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
}

export async function getProductRow(slug: string) {
  const rows = await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1);
  return rows[0] ?? null;
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
  return db.select().from(schema.products).orderBy(schema.products.name);
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
}
