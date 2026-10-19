import "server-only";
import { libsql } from "./db";

export interface Lead {
  email?: string;
  phone?: string;
  name?: string;
  source: string;     // "contact" | "whatsapp-quote" | "whatsapp-enquiry" | "tyrone" | ...
  message?: string;
  productName?: string;
  sku?: string;
  productUrl?: string;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/;

/** Pull an email / SA phone number out of free text (for Tyrone lead capture). */
export function extractContact(text: string): { email?: string; phone?: string } {
  const email = text.match(EMAIL_RE)?.[0];
  const phone = text.replace(email ?? "", "").match(PHONE_RE)?.[0]?.replace(/\s/g, "");
  return { email, phone };
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    phone TEXT,
    name TEXT,
    source TEXT NOT NULL,
    message TEXT,
    product_name TEXT,
    sku TEXT,
    product_url TEXT,
    created_at INTEGER NOT NULL
  )`);
  // Add the product-context columns to tables created before they existed.
  // SQLite has no "ADD COLUMN IF NOT EXISTS", so just ignore the duplicate error.
  for (const col of ["product_name TEXT", "sku TEXT", "product_url TEXT"]) {
    try { await libsql.execute(`ALTER TABLE contacts ADD COLUMN ${col}`); } catch { /* column already exists */ }
  }
  ensured = true;
}

/** Store a captured lead. De-dupes only exact repeats (same contact + same
 *  source + same product within 24h) so different forms / different products
 *  are always kept. Never throws. */
export async function saveLead(l: Lead): Promise<boolean> {
  if (!l.email && !l.phone) return false;
  try {
    await ensureTable();
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const dup = await libsql.execute({
      sql: `SELECT id FROM contacts
            WHERE created_at > ? AND source = ?
              AND ((email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?))
              AND IFNULL(product_name,'') = IFNULL(?,'') LIMIT 1`,
      args: [dayAgo, l.source, l.email ?? "", l.phone ?? "", l.productName ?? null],
    });
    if (dup.rows.length) return false;
    await libsql.execute({
      sql: `INSERT INTO contacts (email, phone, name, source, message, product_name, sku, product_url, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [
        l.email ?? null, l.phone ?? null, l.name ?? null, l.source, l.message ?? null,
        l.productName ?? null, l.sku ?? null, l.productUrl ?? null, Date.now(),
      ],
    });
    return true;
  } catch (err) {
    console.error("[contacts] save failed", err);
    return false;
  }
}

/** Recent leads for the admin view, optionally filtered to one source (tab). */
export async function listLeads(opts: { limit?: number; source?: string } = {}): Promise<Record<string, unknown>[]> {
  const limit = opts.limit ?? 200;
  try {
    await ensureTable();
    const res = opts.source
      ? await libsql.execute({ sql: `SELECT * FROM contacts WHERE source = ? ORDER BY id DESC LIMIT ?`, args: [opts.source, limit] })
      : await libsql.execute({ sql: `SELECT * FROM contacts ORDER BY id DESC LIMIT ?`, args: [limit] });
    return res.rows as unknown as Record<string, unknown>[];
  } catch { return []; }
}

/** Count of leads per source, for the admin tab badges. */
export async function leadCounts(): Promise<Record<string, number>> {
  try {
    await ensureTable();
    const res = await libsql.execute(`SELECT source, COUNT(*) as n FROM contacts GROUP BY source`);
    const out: Record<string, number> = {};
    for (const r of res.rows as unknown as { source: string; n: number }[]) out[String(r.source)] = Number(r.n);
    return out;
  } catch { return {}; }
}

export async function getLead(id: number): Promise<Record<string, unknown> | null> {
  try {
    await ensureTable();
    const res = await libsql.execute({ sql: `SELECT * FROM contacts WHERE id = ? LIMIT 1`, args: [id] });
    return (res.rows[0] as unknown as Record<string, unknown>) ?? null;
  } catch { return null; }
}
