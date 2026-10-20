import "server-only";
import { libsql } from "./db";

export type EnquiryType = "whatsapp" | "tyrone" | "call";

export interface Enquiry {
  type: EnquiryType;
  productSlug?: string;
  productName?: string;
  sku?: string;
  price?: number;        // minor units
  message?: string;
  storeId?: string;
  storeName?: string;
  /** Submitted by a logged-in staff member (a test, not a real customer). */
  test?: boolean;
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    product_slug TEXT,
    product_name TEXT,
    sku TEXT,
    price INTEGER,
    message TEXT,
    store_id TEXT,
    store_name TEXT,
    created_at INTEGER NOT NULL
  )`);
  try { await libsql.execute("ALTER TABLE enquiries ADD COLUMN test INTEGER NOT NULL DEFAULT 0"); } catch { /* exists */ }
  ensured = true;
}

/** Record a WhatsApp / Tyrone / call-tap enquiry to the DB. Never throws. */
export async function logEnquiry(e: Enquiry): Promise<void> {
  try {
    await ensureTable();
    await libsql.execute({
      sql: `INSERT INTO enquiries (type, product_slug, product_name, sku, price, message, store_id, store_name, created_at, test)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [e.type, e.productSlug ?? null, e.productName ?? null, e.sku ?? null, e.price ?? null, e.message ?? null, e.storeId ?? null, e.storeName ?? null, Date.now(), e.test ? 1 : 0],
    });
  } catch (err) {
    console.error("[enquiry] log failed", err);
  }
}

/** Recent enquiries for the admin view. */
export async function listEnquiries(limit = 100): Promise<Record<string, unknown>[]> {
  try {
    await ensureTable();
    const res = await libsql.execute({ sql: `SELECT * FROM enquiries ORDER BY id DESC LIMIT ?`, args: [limit] });
    return res.rows as unknown as Record<string, unknown>[];
  } catch { return []; }
}

export async function getEnquiry(id: number): Promise<Record<string, unknown> | null> {
  try {
    await ensureTable();
    const res = await libsql.execute({ sql: `SELECT * FROM enquiries WHERE id = ? LIMIT 1`, args: [id] });
    return (res.rows[0] as unknown as Record<string, unknown>) ?? null;
  } catch { return null; }
}

/** Call-tap counts per store since a given time (for the weekly digest). */
export async function callTapSummary(sinceMs: number): Promise<{ storeName: string; taps: number }[]> {
  try {
    await ensureTable();
    const res = await libsql.execute({
      sql: `SELECT store_name as storeName, COUNT(*) as taps FROM enquiries
            WHERE type='call' AND created_at >= ? GROUP BY store_name ORDER BY taps DESC`,
      args: [sinceMs],
    });
    return res.rows.map((r) => ({ storeName: String(r.storeName ?? "Unknown"), taps: Number(r.taps) }));
  } catch {
    return [];
  }
}
