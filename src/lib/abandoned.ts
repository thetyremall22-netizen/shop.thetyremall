import "server-only";
import { libsql } from "./db";

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

/** Capture (or refresh) a cart against an email the shopper entered at checkout. */
export async function captureAbandoned(email: string, items: AbandonedItem[], total: number, phone?: string): Promise<void> {
  if (!email || !items.length) return;
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

/** Mark a cart recovered once that email completes an order. */
export async function markRecovered(email: string): Promise<void> {
  if (!email) return;
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
