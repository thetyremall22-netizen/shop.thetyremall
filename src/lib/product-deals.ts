import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";
import type { Deal, DealKind } from "./deals";

// A deal set on individual products (Admin → product → "Deal / offer", or the
// products list's bulk "Deal" action): Buy X get Y free, % off, R off each or a
// deal price — with optional start / end dates and a name shown to customers.
// It goes through the same deal maths as special / sale category deals (see
// lib/deals.ts), so the cart, checkout, PayFast amount, orders and emails agree.

export const PRODUCT_DEALS_TAG = "product-deals";

export interface ProductDeal {
  slug: string;
  kind: DealKind;
  buy: number; get: number; percent: number;
  amount: number;  // cents off each (amount)
  price: number;   // deal price each, cents (price)
  limit: number | null;
  label: string;   // shown to customers, e.g. "Weekend Special"
  startAt: number | null;
  endAt: number | null;
  updatedAt: number;
}
export type ProductDealInput = Omit<ProductDeal, "slug" | "updatedAt">;
export type ProductDealStatus = "scheduled" | "live" | "ended";

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS product_deals (
    slug TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    buy INTEGER NOT NULL DEFAULT 0,
    get INTEGER NOT NULL DEFAULT 0,
    percent INTEGER NOT NULL DEFAULT 0,
    amount INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL DEFAULT 0,
    deal_limit INTEGER,
    label TEXT NOT NULL DEFAULT '',
    start_at INTEGER,
    end_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  ensured = true;
}

const KINDS: DealKind[] = ["bxgy", "percent", "amount", "price"];
function toDeal(r: Record<string, unknown>): ProductDeal {
  return {
    slug: String(r.slug), kind: KINDS.includes(r.kind as DealKind) ? (r.kind as DealKind) : "percent",
    buy: Number(r.buy ?? 0), get: Number(r.get ?? 0), percent: Number(r.percent ?? 0),
    amount: Number(r.amount ?? 0), price: Number(r.price ?? 0),
    limit: r.deal_limit == null ? null : Number(r.deal_limit), label: String(r.label ?? ""),
    startAt: r.start_at == null ? null : Number(r.start_at), endAt: r.end_at == null ? null : Number(r.end_at),
    updatedAt: Number(r.updated_at ?? 0),
  };
}

export function productDealStatus(d: Pick<ProductDeal, "startAt" | "endAt">, now = Date.now()): ProductDealStatus {
  if (d.startAt && now < d.startAt) return "scheduled";
  if (d.endAt && now > d.endAt) return "ended";
  return "live";
}

/** The shared deal shape for the cart / checkout maths. */
export function asDeal(d: ProductDeal): Deal {
  return { slug: `product:${d.slug}`, name: d.label.trim() || "Special offer", kind: d.kind, buy: d.buy, get: d.get, percent: d.percent, amount: d.amount, price: d.price, limit: d.limit };
}

/** A problem with a deal's settings, or null. */
export function productDealProblem(i: ProductDealInput): string | null {
  if (!KINDS.includes(i.kind)) return "Choose a deal type.";
  if (i.kind === "bxgy" && !(i.buy > 0 && i.get > 0)) return "For “Buy X, get Y free”, enter how many to buy and how many are free.";
  if (i.kind === "percent" && !(i.percent > 0 && i.percent <= 100)) return "Enter a % off between 1 and 100.";
  if (i.kind === "percent" && i.percent === 100 && !(i.limit && i.limit > 0)) return "A 100% off (free) deal needs a limit per order, e.g. 4.";
  if (i.kind === "amount" && !(i.amount > 0)) return "Enter how many Rand off each item.";
  if (i.kind === "price" && !(i.price > 0)) return "Enter the deal price for each item.";
  if (i.startAt && i.endAt && i.endAt <= i.startAt) return "The end date must be after the start date.";
  return null;
}

export async function getProductDeals(slugs: string[]): Promise<Map<string, ProductDeal>> {
  await ensureTable();
  const out = new Map<string, ProductDeal>();
  for (let i = 0; i < slugs.length; i += 400) {
    const chunk = slugs.slice(i, i + 400);
    const r = await libsql.execute({ sql: `SELECT * FROM product_deals WHERE slug IN (${chunk.map(() => "?").join(",")})`, args: chunk });
    for (const row of r.rows as Record<string, unknown>[]) out.set(String(row.slug), toDeal(row));
  }
  return out;
}

export async function getProductDeal(slug: string): Promise<ProductDeal | null> {
  return (await getProductDeals([slug])).get(slug) ?? null;
}

function bump() {
  try { revalidateTag(PRODUCT_DEALS_TAG, "max"); } catch { /* outside a request */ }
}

/** Set (or with null, remove) the deal on these products. Returns what they had
 *  before, for undo. */
export async function setProductDeals(slugs: string[], deal: ProductDealInput | null): Promise<{ slug: string; deal: ProductDeal | null }[]> {
  await ensureTable();
  const before = await getProductDeals(slugs);
  const now = Date.now();
  const stmts = slugs.map((slug) => deal
    ? {
        sql: `INSERT INTO product_deals (slug, kind, buy, get, percent, amount, price, deal_limit, label, start_at, end_at, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(slug) DO UPDATE SET kind = excluded.kind, buy = excluded.buy, get = excluded.get, percent = excluded.percent, amount = excluded.amount,
                price = excluded.price, deal_limit = excluded.deal_limit, label = excluded.label, start_at = excluded.start_at, end_at = excluded.end_at, updated_at = excluded.updated_at`,
        args: [slug, deal.kind, deal.buy, deal.get, deal.percent, deal.amount, deal.price, deal.limit, deal.label.trim().slice(0, 60), deal.startAt, deal.endAt, now, now],
      }
    : { sql: "DELETE FROM product_deals WHERE slug = ?", args: [slug] });
  for (let i = 0; i < stmts.length; i += 300) await libsql.batch(stmts.slice(i, i + 300));
  bump();
  return slugs.map((slug) => ({ slug, deal: before.get(slug) ?? null }));
}

/** Put deals back as they were (undo of a bulk deal change). */
export async function restoreProductDeals(items: { slug: string; deal: ProductDeal | null }[]): Promise<number> {
  await ensureTable();
  for (const it of items) {
    if (it.deal) await setProductDeals([it.slug], it.deal);
    else await libsql.execute({ sql: "DELETE FROM product_deals WHERE slug = ?", args: [it.slug] });
  }
  bump();
  return items.length;
}

/** Product deals running right now, by product slug. Cached for minutes (so a
 *  deal starts / ends within minutes of its time) and refreshed on any change. */
export async function liveProductDeals(): Promise<Record<string, Deal>> {
  "use cache";
  cacheTag(PRODUCT_DEALS_TAG);
  cacheLife("minutes");
  try {
    await ensureTable();
    const now = Date.now();
    const r = await libsql.execute({ sql: "SELECT * FROM product_deals WHERE (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at >= ?)", args: [now, now] });
    const out: Record<string, Deal> = {};
    for (const row of r.rows as Record<string, unknown>[]) { const d = toDeal(row); if (!productDealProblem(d)) out[d.slug] = asDeal(d); }
    return out;
  } catch { return {}; }
}
