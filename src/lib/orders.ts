import "server-only";
import { eq, desc, sql } from "drizzle-orm";
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
  createdAt: string;
  updatedAt: string;
}

type Row = typeof schema.orders.$inferSelect;

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
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

export async function saveOrder(order: Order): Promise<void> {
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
        updatedAt: now,
      },
    });
}

export async function getOrder(id: string): Promise<Order | null> {
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
  const res = await libsql.execute(
    "UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'order_seq' RETURNING value"
  );
  const n = res.rows.length ? Number(res.rows[0].value) : Date.now() % 100000;
  return `TTM-${1000 + n}`;
}

// ---- admin ------------------------------------------------------------------
export async function listOrders(opts: { page?: number; perPage?: number; status?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 25;
  const where = opts.status ? eq(schema.orders.status, opts.status) : undefined;
  const rows = await db.select().from(schema.orders).where(where)
    .orderBy(desc(schema.orders.id)).limit(perPage).offset((page - 1) * perPage);
  const totalRow = await db.select({ c: sql<number>`count(*)` }).from(schema.orders).where(where);
  return { orders: rows.map(rowToOrder), total: Number(totalRow[0].c), page, perPage };
}
