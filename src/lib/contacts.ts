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
  /** Submitted by a logged-in staff member (a test, not a real customer). */
  test?: boolean;
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
  for (const col of ["product_name TEXT", "sku TEXT", "product_url TEXT", "notes TEXT", "updated_at INTEGER", "test INTEGER NOT NULL DEFAULT 0"]) {
    try { await libsql.execute(`ALTER TABLE contacts ADD COLUMN ${col}`); } catch { /* column already exists */ }
  }
  ensured = true;
}

/** Store a captured lead and return its id (null if not saved). Drops only an
 *  accidental double-submit (same source + contact + product + message within
 *  10 minutes), so every genuine enquiry is kept. Never throws. */
export async function saveLead(l: Lead): Promise<number | null> {
  if (!l.email && !l.phone) return null;
  try {
    await ensureTable();
    const since = Date.now() - 10 * 60 * 1000;
    const dup = await libsql.execute({
      sql: `SELECT id FROM contacts
            WHERE created_at > ? AND source = ?
              AND ((email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?))
              AND IFNULL(product_name,'') = IFNULL(?,'')
              AND IFNULL(message,'') = IFNULL(?,'') LIMIT 1`,
      args: [since, l.source, l.email ?? "", l.phone ?? "", l.productName ?? null, l.message ?? null],
    });
    if (dup.rows.length) return null;
    const res = await libsql.execute({
      sql: `INSERT INTO contacts (email, phone, name, source, message, product_name, sku, product_url, created_at, test)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [
        l.email ?? null, l.phone ?? null, l.name ?? null, l.source, l.message ?? null,
        l.productName ?? null, l.sku ?? null, l.productUrl ?? null, Date.now(), l.test ? 1 : 0,
      ],
    });
    return Number(res.lastInsertRowid) || null;
  } catch (err) {
    console.error("[contacts] save failed", err);
    return null;
  }
}

/** Recent leads for the admin view, optionally filtered to one source (tab)
 *  and/or a search term (name, email, phone, product, SKU, message, notes). */
export async function listLeads(opts: { limit?: number; source?: string; q?: string } = {}): Promise<Record<string, unknown>[]> {
  const limit = opts.limit ?? 200;
  try {
    await ensureTable();
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (opts.source) { where.push("source = ?"); args.push(opts.source); }
    const q = opts.q?.trim();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      const digits = q.replace(/\D/g, "");
      const cols = ["name", "email", "phone", "product_name", "sku", "message", "notes", "source"];
      const parts = cols.map((c) => `LOWER(IFNULL(${c},'')) LIKE ?`);
      args.push(...cols.map(() => like));
      // "082 123 4567" should find "+27821234567": match on the last 9 digits too.
      if (digits.length >= 6) { parts.push(`REPLACE(IFNULL(phone,''),' ','') LIKE ?`); args.push(`%${digits.slice(-9)}%`); }
      where.push(`(${parts.join(" OR ")})`);
    }
    args.push(limit);
    const res = await libsql.execute({
      sql: `SELECT * FROM contacts ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`,
      args,
    });
    return res.rows as unknown as Record<string, unknown>[];
  } catch { return []; }
}

export const LEAD_EDITABLE = ["name", "email", "phone", "message", "product_name", "sku", "product_url", "notes"] as const;
export type LeadField = (typeof LEAD_EDITABLE)[number];

/** Edit a lead's fields; returns the row before and after the change. */
export async function updateLead(id: number, patch: Partial<Record<LeadField, string | null>>): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> } | null> {
  await ensureTable();
  const before = await getLead(id);
  if (!before) return null;
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const k of LEAD_EDITABLE) {
    if (k in patch) { sets.push(`${k} = ?`); args.push(patch[k] ?? null); }
  }
  if (sets.length) {
    sets.push("updated_at = ?"); args.push(Date.now());
    args.push(id);
    await libsql.execute({ sql: `UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`, args });
  }
  const after = (await getLead(id)) ?? before;
  return { before, after };
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
