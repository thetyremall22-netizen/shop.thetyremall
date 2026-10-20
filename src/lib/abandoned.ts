import "server-only";
import { libsql } from "./db";
import { onOrderPaid, captureCheckout } from "./cart-recovery";

export interface AbandonedItem { name: string; qty: number; price: number; slug?: string; image?: string | null }

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS abandoned_carts (
    email TEXT PRIMARY KEY,
    phone TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    total INTEGER NOT NULL DEFAULT 0,
    recovered INTEGER NOT NULL DEFAULT 0,
    emailed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  ensured = true;
}

/** Capture (or refresh) a cart against an email the shopper entered at checkout.
 *  Also feeds Cart Recovery (the multi-email flow). */
export async function captureAbandoned(email: string, items: AbandonedItem[], total: number, phone?: string): Promise<void> {
  if (!email || !items.length) return;
  await captureCheckout({
    email, phone, total,
    items: items.filter((i) => i.slug).map((i) => ({ slug: i.slug as string, name: i.name, qty: i.qty, price: i.price, image: i.image ?? null })),
  }).catch(() => {});
  try {
    await ensureTable();
    const now = Date.now();
    await libsql.execute({
      sql: `INSERT INTO abandoned_carts (email, phone, items, total, recovered, emailed_at, created_at, updated_at)
            VALUES (?,?,?,?,0,NULL,?,?)
            ON CONFLICT(email) DO UPDATE SET
              phone=COALESCE(excluded.phone, abandoned_carts.phone),
              items=excluded.items, total=excluded.total,
              recovered=0, emailed_at=NULL, updated_at=excluded.updated_at`,
      args: [email, phone ?? null, JSON.stringify(items), total, now, now],
    });
  } catch (err) {
    console.error("[abandoned] capture failed", err);
  }
}

/** An order was paid: close the old cart record and let Cart Recovery credit a
 *  recovery if the customer came back via a recovery email. */
export async function markRecovered(email: string, orderRef?: string, value?: number): Promise<void> {
  if (!email) return;
  await onOrderPaid(email, orderRef, value);
  try {
    await ensureTable();
    await libsql.execute({ sql: `UPDATE abandoned_carts SET recovered=1, updated_at=? WHERE email=?`, args: [Date.now(), email] });
  } catch {}
}

/** Carts abandoned longer than `minAgeMs`, not recovered, not yet emailed. */
export async function pendingRecoveries(minAgeMs = 3600_000): Promise<{ email: string; items: AbandonedItem[]; total: number }[]> {
  try {
    await ensureTable();
    const cutoff = Date.now() - minAgeMs;
    const res = await libsql.execute({
      sql: `SELECT email, items, total FROM abandoned_carts WHERE recovered=0 AND emailed_at IS NULL AND updated_at < ? LIMIT 200`,
      args: [cutoff],
    });
    return res.rows.map((r) => ({
      email: String(r.email),
      items: JSON.parse(String(r.items || "[]")),
      total: Number(r.total),
    }));
  } catch { return []; }
}

export async function markEmailed(email: string): Promise<void> {
  try { await ensureTable(); await libsql.execute({ sql: `UPDATE abandoned_carts SET emailed_at=? WHERE email=?`, args: [Date.now(), email] }); } catch {}
}

/** Recent abandoned carts for the admin view. */
export async function listAbandoned(limit = 100): Promise<Record<string, unknown>[]> {
  try {
    await ensureTable();
    const res = await libsql.execute({ sql: `SELECT * FROM abandoned_carts ORDER BY updated_at DESC LIMIT ?`, args: [limit] });
    return res.rows as unknown as Record<string, unknown>[];
  } catch { return []; }
}

/** One abandoned cart by its email (the table's primary key). */
export async function getAbandoned(email: string): Promise<Record<string, unknown> | null> {
  try {
    await ensureTable();
    const res = await libsql.execute({ sql: `SELECT * FROM abandoned_carts WHERE email = ? LIMIT 1`, args: [email] });
    return (res.rows[0] as unknown as Record<string, unknown>) ?? null;
  } catch { return null; }
}
