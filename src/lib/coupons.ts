import "server-only";
import { libsql } from "./db";

export type DiscountType = "percentage" | "fixed";
export type CouponScope = "all" | "products";

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number; // pct (1-100) or fixed minor units (cents)
  scope: CouponScope;
  productSlugs: string[];
  minSpend: number; // cents, 0 = none
  perCustomerLimit: number; // 0 = unlimited
  usageLimitTotal: number; // 0 = unlimited
  active: boolean;
  startsAt: number | null;
  endsAt: number | null;
  timesUsed: number;
  createdAt: number;
}

export interface CouponItem { slug: string; price: number; qty: number; type?: string }

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value INTEGER NOT NULL DEFAULT 0,
    scope TEXT NOT NULL DEFAULT 'all',
    product_slugs TEXT NOT NULL DEFAULT '[]',
    min_spend INTEGER NOT NULL DEFAULT 0,
    per_customer_limit INTEGER NOT NULL DEFAULT 0,
    usage_limit_total INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    starts_at INTEGER,
    ends_at INTEGER,
    times_used INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    order_ref TEXT,
    customer_email TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

type Row = Record<string, unknown>;
function toCoupon(r: Row): Coupon {
  const slugs = (() => { try { return JSON.parse(String(r.product_slugs || "[]")) as string[]; } catch { return []; } })();
  return {
    id: Number(r.id), code: String(r.code), description: String(r.description ?? ""),
    discountType: String(r.discount_type) as DiscountType, discountValue: Number(r.discount_value) || 0,
    scope: String(r.scope) as CouponScope, productSlugs: slugs,
    minSpend: Number(r.min_spend) || 0, perCustomerLimit: Number(r.per_customer_limit) || 0, usageLimitTotal: Number(r.usage_limit_total) || 0,
    active: Number(r.active) === 1, startsAt: r.starts_at == null ? null : Number(r.starts_at), endsAt: r.ends_at == null ? null : Number(r.ends_at),
    timesUsed: Number(r.times_used) || 0, createdAt: Number(r.created_at) || 0,
  };
}

const normCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

export async function listCoupons(): Promise<Coupon[]> {
  try { await ensureTables(); const r = await libsql.execute("SELECT * FROM coupons ORDER BY id DESC"); return (r.rows as unknown as Row[]).map(toCoupon); }
  catch (e) { console.error("[coupons] list failed:", (e as Error).message); return []; }
}

export async function getCoupon(id: number): Promise<Coupon | null> {
  try { await ensureTables(); const r = await libsql.execute({ sql: "SELECT * FROM coupons WHERE id = ? LIMIT 1", args: [id] }); return r.rows.length ? toCoupon(r.rows[0] as unknown as Row) : null; }
  catch { return null; }
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  try { await ensureTables(); const r = await libsql.execute({ sql: "SELECT * FROM coupons WHERE code = ? LIMIT 1", args: [normCode(code)] }); return r.rows.length ? toCoupon(r.rows[0] as unknown as Row) : null; }
  catch { return null; }
}

export interface CouponInput {
  code: string; description?: string; discountType: DiscountType; discountValue: number;
  scope: CouponScope; productSlugs?: string[]; minSpend?: number;
  perCustomerLimit?: number; usageLimitTotal?: number; active?: boolean;
  startsAt?: number | null; endsAt?: number | null;
}

/** Normalise a raw request body into a CouponInput (shared by create/update routes). */
export function parseCouponInput(b: Record<string, unknown>): CouponInput {
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
  return {
    code: String(b.code ?? ""),
    description: String(b.description ?? ""),
    discountType: b.discountType === "fixed" ? "fixed" : "percentage",
    discountValue: num(b.discountValue),
    scope: b.scope === "products" ? "products" : "all",
    productSlugs: Array.isArray(b.productSlugs) ? (b.productSlugs as unknown[]).map(String).filter(Boolean) : [],
    minSpend: num(b.minSpend),
    perCustomerLimit: num(b.perCustomerLimit),
    usageLimitTotal: num(b.usageLimitTotal),
    active: b.active !== false,
    startsAt: b.startsAt == null ? null : num(b.startsAt),
    endsAt: b.endsAt == null ? null : num(b.endsAt),
  };
}

function validateInput(i: CouponInput): string | null {
  if (!normCode(i.code)) return "A coupon code is required.";
  if (i.discountType !== "percentage" && i.discountType !== "fixed") return "Pick a discount type.";
  if (i.discountType === "percentage" && (i.discountValue <= 0 || i.discountValue > 100)) return "Percentage must be between 1 and 100.";
  if (i.discountType === "fixed" && i.discountValue <= 0) return "Enter a discount amount.";
  if (i.scope === "products" && !(i.productSlugs && i.productSlugs.length)) return "Choose at least one product for a product-scoped coupon.";
  if (i.startsAt && i.endsAt && i.endsAt < i.startsAt) return "End date must be after the start date.";
  return null;
}

export async function createCoupon(i: CouponInput): Promise<{ ok: boolean; error?: string; id?: number }> {
  await ensureTables();
  const err = validateInput(i); if (err) return { ok: false, error: err };
  const code = normCode(i.code);
  if (await getCouponByCode(code)) return { ok: false, error: "That coupon code already exists." };
  const now = Date.now();
  const res = await libsql.execute({
    sql: `INSERT INTO coupons (code, description, discount_type, discount_value, scope, product_slugs, min_spend, per_customer_limit, usage_limit_total, active, starts_at, ends_at, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [code, (i.description ?? "").slice(0, 300), i.discountType, Math.round(i.discountValue), i.scope, JSON.stringify(i.productSlugs ?? []),
      Math.max(0, Math.round(i.minSpend ?? 0)), Math.max(0, Math.round(i.perCustomerLimit ?? 0)), Math.max(0, Math.round(i.usageLimitTotal ?? 0)),
      i.active === false ? 0 : 1, i.startsAt ?? null, i.endsAt ?? null, now, now],
  });
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function updateCoupon(id: number, i: CouponInput): Promise<{ ok: boolean; error?: string }> {
  await ensureTables();
  const err = validateInput(i); if (err) return { ok: false, error: err };
  const code = normCode(i.code);
  const clash = await getCouponByCode(code);
  if (clash && clash.id !== id) return { ok: false, error: "That coupon code already exists." };
  await libsql.execute({
    sql: `UPDATE coupons SET code=?, description=?, discount_type=?, discount_value=?, scope=?, product_slugs=?, min_spend=?, per_customer_limit=?, usage_limit_total=?, active=?, starts_at=?, ends_at=?, updated_at=? WHERE id=?`,
    args: [code, (i.description ?? "").slice(0, 300), i.discountType, Math.round(i.discountValue), i.scope, JSON.stringify(i.productSlugs ?? []),
      Math.max(0, Math.round(i.minSpend ?? 0)), Math.max(0, Math.round(i.perCustomerLimit ?? 0)), Math.max(0, Math.round(i.usageLimitTotal ?? 0)),
      i.active === false ? 0 : 1, i.startsAt ?? null, i.endsAt ?? null, Date.now(), id],
  });
  return { ok: true };
}

export async function deleteCoupon(id: number): Promise<void> {
  try { await ensureTables(); await libsql.execute({ sql: "DELETE FROM coupons WHERE id = ?", args: [id] }); } catch { /* ignore */ }
}

export interface CouponResult { valid: boolean; error?: string; code?: string; discount?: number; description?: string }

/** Validate a coupon against a cart. `discount` is in minor units (cents). */
export async function validateCoupon(code: string, cart: { items: CouponItem[]; email?: string; now?: number }): Promise<CouponResult> {
  try {
    const c = await getCouponByCode(code);
    if (!c) return { valid: false, error: "That code isn't valid." };
    if (!c.active) return { valid: false, error: "This coupon is no longer active." };
    const now = cart.now ?? Date.now();
    if (c.startsAt && now < c.startsAt) return { valid: false, error: "This coupon isn't active yet." };
    if (c.endsAt && now > c.endsAt) return { valid: false, error: "This coupon has expired." };
    if (c.usageLimitTotal > 0 && c.timesUsed >= c.usageLimitTotal) return { valid: false, error: "This coupon has been fully redeemed." };
    if (c.perCustomerLimit > 0 && cart.email) {
      const r = await libsql.execute({ sql: "SELECT COUNT(*) n FROM coupon_redemptions WHERE coupon_id = ? AND lower(customer_email) = lower(?)", args: [c.id, cart.email] });
      if (Number(r.rows[0].n) >= c.perCustomerLimit) return { valid: false, error: "You've already used this coupon." };
    }
    const eligible = c.scope === "all" ? cart.items : cart.items.filter((it) => c.productSlugs.includes(it.slug));
    const eligibleSubtotal = eligible.reduce((n, it) => n + it.price * it.qty, 0);
    if (eligibleSubtotal <= 0) return { valid: false, error: "This coupon doesn't apply to the items in your cart." };
    if (c.minSpend > 0 && eligibleSubtotal < c.minSpend) {
      return { valid: false, error: `Spend at least R${(c.minSpend / 100).toLocaleString("en-ZA")} to use this coupon.` };
    }
    let discount = c.discountType === "percentage" ? Math.round((eligibleSubtotal * c.discountValue) / 100) : Math.min(c.discountValue, eligibleSubtotal);
    discount = Math.max(0, Math.min(discount, eligibleSubtotal));
    return { valid: true, code: c.code, discount, description: c.description };
  } catch (e) {
    console.error("[coupons] validate failed:", (e as Error).message);
    return { valid: false, error: "Couldn't check that coupon. Try again." };
  }
}

/** Record a redemption when an order is paid, and bump the usage counter. */
export async function recordRedemption(code: string, orderRef: string, email: string, amount: number): Promise<void> {
  try {
    await ensureTables();
    const c = await getCouponByCode(code);
    if (!c) return;
    await libsql.execute({ sql: "INSERT INTO coupon_redemptions (coupon_id, code, order_ref, customer_email, amount, created_at) VALUES (?,?,?,?,?,?)", args: [c.id, c.code, orderRef, email, amount, Date.now()] });
    await libsql.execute({ sql: "UPDATE coupons SET times_used = times_used + 1 WHERE id = ?", args: [c.id] });
  } catch (e) {
    console.error("[coupons] recordRedemption failed:", (e as Error).message);
  }
}
