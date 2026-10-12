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
