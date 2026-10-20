import "server-only";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, schema, libsql } from "./db";

export type EmailType =
  | "order_paid"
  | "order_new_admin"
  | "order_failed"
  | "order_failed_admin"
  | "order_cancelled"
  | "order_cancelled_admin"
  | "order_refunded"
  | "order_completed"
  | "order_on_hold"
  | "abandoned_cart"
  | "enquiry"
  | "lead_confirmation"
  | "custom";

export type EmailStatus = "sent" | "failed" | "skipped";

export interface LoggedEmail {
  toAddr: string;
  cc?: string[];
  subject: string;
  html: string;
  type: EmailType;
  orderRef?: string | null;
  status: EmailStatus;
  provider: string;
  error?: string | null;
  resend?: boolean;
}

// Create the emails table on demand (same pattern as orders/enquiries) so it
// works on the in-memory fallback and seeds nothing.
let ensured = false;
async function ensureSchema() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_addr TEXT NOT NULL DEFAULT '',
    cc TEXT NOT NULL DEFAULT '[]',
    subject TEXT NOT NULL DEFAULT '',
    html TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'custom',
    order_ref TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    provider TEXT NOT NULL DEFAULT '',
    error TEXT,
    resend INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

/** Record an outbound email. Never throws — logging must not break sending. */
export async function logEmail(e: LoggedEmail): Promise<void> {
  try {
    await ensureSchema();
    await db.insert(schema.emails).values({
      toAddr: e.toAddr,
      cc: JSON.stringify(e.cc ?? []),
      subject: e.subject,
      html: e.html,
      type: e.type,
      orderRef: e.orderRef ?? null,
      status: e.status,
      provider: e.provider,
      error: e.error ?? null,
      resend: e.resend ?? false,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("[email-log] logEmail failed:", (err as Error).message);
  }
}

export async function listEmails(opts: { page?: number; perPage?: number; type?: string; status?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 30;
  try {
    await ensureSchema();
    const conds = [];
    if (opts.type) conds.push(eq(schema.emails.type, opts.type));
    if (opts.status) conds.push(eq(schema.emails.status, opts.status));
    const where = conds.length ? and(...conds) : undefined;
    // Don't pull the (large) html column into the list query.
    const rows = await db
      .select({
        id: schema.emails.id,
        toAddr: schema.emails.toAddr,
        subject: schema.emails.subject,
        type: schema.emails.type,
        orderRef: schema.emails.orderRef,
        status: schema.emails.status,
        provider: schema.emails.provider,
        resend: schema.emails.resend,
        createdAt: schema.emails.createdAt,
      })
      .from(schema.emails)
      .where(where)
      .orderBy(desc(schema.emails.id))
      .limit(perPage)
      .offset((page - 1) * perPage);
    const totalRow = await db.select({ c: sql<number>`count(*)` }).from(schema.emails).where(where);
    return { rows, total: Number(totalRow[0].c), page, perPage };
  } catch (e) {
    console.error("[email-log] listEmails failed:", (e as Error).message);
    return { rows: [], total: 0, page, perPage };
  }
}

/** All logged emails for one order reference, newest first (no html column). */
export async function listEmailsForOrder(orderRef: string) {
  try {
    await ensureSchema();
    return await db
      .select({
        id: schema.emails.id,
        toAddr: schema.emails.toAddr,
        subject: schema.emails.subject,
        type: schema.emails.type,
        status: schema.emails.status,
        resend: schema.emails.resend,
        createdAt: schema.emails.createdAt,
      })
      .from(schema.emails)
      .where(eq(schema.emails.orderRef, orderRef))
      .orderBy(desc(schema.emails.id));
  } catch (e) {
    console.error("[email-log] listEmailsForOrder failed:", (e as Error).message);
    return [];
  }
}

export async function getEmail(id: number) {
  try {
    await ensureSchema();
    const rows = await db.select().from(schema.emails).where(eq(schema.emails.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    console.error("[email-log] getEmail failed:", (e as Error).message);
    return null;
  }
}

/** Human labels for the email types, for the admin UI. */
export const EMAIL_TYPE_LABELS: Record<string, string> = {
  order_paid: "Order confirmed (customer)",
  order_new_admin: "New order (shop)",
  order_failed: "Payment failed (customer)",
  order_failed_admin: "Failed order (shop)",
  order_cancelled: "Order cancelled (customer)",
  order_cancelled_admin: "Cancelled order (shop)",
  order_refunded: "Order refunded",
  order_completed: "Order completed",
  order_on_hold: "Order on hold",
  abandoned_cart: "Abandoned cart",
  enquiry: "Enquiry (shop)",
  lead_confirmation: "Enquiry received (customer)",
  custom: "Custom",
};
