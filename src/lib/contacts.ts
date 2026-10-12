import "server-only";
import { libsql } from "./db";

export interface Lead {
  email?: string;
  phone?: string;
  name?: string;
  source: string;     // "tyrone" | "checkout" | ...
  message?: string;
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
    created_at INTEGER NOT NULL
  )`);
  ensured = true;
}

/** Store a captured lead. De-dupes on (email|phone) within the last 24h. Never throws. */
export async function saveLead(l: Lead): Promise<boolean> {
  if (!l.email && !l.phone) return false;
  try {
    await ensureTable();
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const dup = await libsql.execute({
      sql: `SELECT id FROM contacts WHERE created_at > ? AND ((email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)) LIMIT 1`,
      args: [dayAgo, l.email ?? "", l.phone ?? ""],
    });
    if (dup.rows.length) return false;
    await libsql.execute({
      sql: `INSERT INTO contacts (email, phone, name, source, message, created_at) VALUES (?,?,?,?,?,?)`,
      args: [l.email ?? null, l.phone ?? null, l.name ?? null, l.source, l.message ?? null, Date.now()],
    });
    return true;
  } catch (err) {
    console.error("[contacts] save failed", err);
    return false;
  }
}

export async function listLeads(limit = 100): Promise<Record<string, unknown>[]> {
  try {
    await ensureTable();
    const res = await libsql.execute({ sql: `SELECT * FROM contacts ORDER BY id DESC LIMIT ?`, args: [limit] });
    return res.rows as unknown as Record<string, unknown>[];
  } catch { return []; }
}
