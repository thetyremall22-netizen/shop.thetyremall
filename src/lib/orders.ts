import "server-only";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, schema, libsql } from "./db";
import type { LineItem, OrderTotals } from "./totals";
import type { DeliveryMethod } from "./shop-config";

export type OrderStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "on-hold";

export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: {
    method: DeliveryMethod;
    address?: { street: string; suburb: string; city: string; province: string; postalCode: string };
    fitmentStore?: string;
    fitmentDate?: string;
  };
  items: LineItem[];
  totals: OrderTotals;
  paymentMethod: string;
  pfPaymentId?: string;
  /** true for PayFast-sandbox / test orders (labelled apart from real orders). */
  test?: boolean;
  /** cumulative amount refunded (minor units). */
  refundedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

type Row = typeof schema.orders.$inferSelect;

// Create the orders + meta tables on demand (matches the pattern used by
// enquiries/contacts/abandoned). This makes the in-memory fallback DB usable
// on Vercel before Turso is connected, so checkout can still reach PayFast.
let ensured = false;
async function ensureSchema() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL UNIQUE,
    reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    customer TEXT NOT NULL DEFAULT '{}',
    delivery TEXT NOT NULL DEFAULT '{}',
    items TEXT NOT NULL DEFAULT '[]',
    totals TEXT NOT NULL DEFAULT '{}',
    payment_method TEXT NOT NULL DEFAULT '',
    pf_payment_id TEXT,
    test INTEGER NOT NULL DEFAULT 0,
    refunded INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  // Add columns to tables created before they existed (ignore if present).
  try { await libsql.execute("ALTER TABLE orders ADD COLUMN test INTEGER NOT NULL DEFAULT 0"); } catch { /* exists */ }
  try { await libsql.execute("ALTER TABLE orders ADD COLUMN refunded INTEGER NOT NULL DEFAULT 0"); } catch { /* exists */ }
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  await libsql.execute(`INSERT OR IGNORE INTO meta (key, value) VALUES ('order_seq', '0')`);
  ensured = true;
}

function rowToOrder(r: Row): Order {
  return {
    id: r.orderId,
    reference: r.reference,
    status: r.status as OrderStatus,
    customer: JSON.parse(r.customer),
    delivery: JSON.parse(r.delivery),
    items: JSON.parse(r.items),
    totals: JSON.parse(r.totals),
    paymentMethod: r.paymentMethod,
    pfPaymentId: r.pfPaymentId ?? undefined,
    test: !!r.test,
    refundedAmount: Number(r.refunded) || 0,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

export async function saveOrder(order: Order): Promise<void> {
  await ensureSchema();
  const now = Date.now();
  await db
    .insert(schema.orders)
    .values({
      orderId: order.id,
      reference: order.reference,
      status: order.status,
      customer: JSON.stringify(order.customer),
      delivery: JSON.stringify(order.delivery),
      items: JSON.stringify(order.items),
      totals: JSON.stringify(order.totals),
      paymentMethod: order.paymentMethod,
      pfPaymentId: order.pfPaymentId ?? null,
      test: order.test ?? false,
      refunded: order.refundedAmount ?? 0,
      createdAt: Date.parse(order.createdAt) || now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.orders.orderId,
      set: {
        status: order.status,
        customer: JSON.stringify(order.customer),
        delivery: JSON.stringify(order.delivery),
        items: JSON.stringify(order.items),
        totals: JSON.stringify(order.totals),
        paymentMethod: order.paymentMethod,
        pfPaymentId: order.pfPaymentId ?? null,
        refunded: order.refundedAmount ?? 0,
        updatedAt: now,
      },
    });
}

export async function getOrder(id: string): Promise<Order | null> {
  await ensureSchema();
  const rows = await db.select().from(schema.orders).where(eq(schema.orders.orderId, id)).limit(1);
  return rows[0] ? rowToOrder(rows[0]) : null;
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
  const current = await getOrder(id);
  if (!current) return null;
  const next: Order = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await saveOrder(next);
  return next;
}

/** Atomic incrementing order reference via the meta counter. */
export async function nextReference(): Promise<string> {
  await ensureSchema();
  const res = await libsql.execute(
    "UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'order_seq' RETURNING value"
  );
  const n = res.rows.length ? Number(res.rows[0].value) : Date.now() % 100000;
  return `TTM-${1000 + n}`;
}

// ---- admin ------------------------------------------------------------------
export async function listOrders(opts: { page?: number; perPage?: number; status?: string; test?: boolean } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 25;
  try {
    await ensureSchema();
    const conds = [];
    if (opts.status) conds.push(eq(schema.orders.status, opts.status));
    if (opts.test !== undefined) conds.push(eq(schema.orders.test, opts.test));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db.select().from(schema.orders).where(where)
      .orderBy(desc(schema.orders.id)).limit(perPage).offset((page - 1) * perPage);
    const totalRow = await db.select({ c: sql<number>`count(*)` }).from(schema.orders).where(where);
    return { orders: rows.map(rowToOrder), total: Number(totalRow[0].c), page, perPage };
  } catch (e) {
    console.error("[db] listOrders fallback to empty:", (e as Error).message);
    return { orders: [] as Order[], total: 0, page, perPage };
  }
}
