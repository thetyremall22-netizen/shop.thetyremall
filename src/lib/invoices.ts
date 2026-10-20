import "server-only";
import { libsql } from "./db";

// Tax invoice numbers: their own sequence (INV-00001, INV-00002, …), issued
// once per order the first time an invoice is sent and reused on every resend,
// so an order always has exactly one invoice number and numbers never repeat.

export interface InvoiceInfo { number: string; issuedAt: number }

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS invoices (
    order_id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    issued_at INTEGER NOT NULL
  )`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  await libsql.execute(`INSERT OR IGNORE INTO meta (key, value) VALUES ('invoice_seq', '0')`);
  ensured = true;
}

export const formatInvoiceNumber = (n: number) => `INV-${String(n).padStart(5, "0")}`;

export async function getInvoice(orderId: string): Promise<InvoiceInfo | null> {
  try {
    await ensureTables();
    const r = await libsql.execute({ sql: "SELECT number, issued_at FROM invoices WHERE order_id = ?", args: [orderId] });
    return r.rows.length ? { number: String(r.rows[0].number), issuedAt: Number(r.rows[0].issued_at) } : null;
  } catch { return null; }
}

/** The order's invoice number, issuing the next one in sequence if it has none. */
export async function getOrIssueInvoice(orderId: string): Promise<InvoiceInfo> {
  await ensureTables();
  const existing = await getInvoice(orderId);
  if (existing) return existing;
  for (let attempt = 0; attempt < 50; attempt++) {
    await libsql.execute("UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'invoice_seq'");
    const r = await libsql.execute("SELECT value FROM meta WHERE key = 'invoice_seq'");
    const number = formatInvoiceNumber(Number(r.rows[0]?.value));
    const issuedAt = Date.now();
    try {
      await libsql.execute({ sql: "INSERT INTO invoices (order_id, number, issued_at) VALUES (?,?,?)", args: [orderId, number, issuedAt] });
      return { number, issuedAt };
    } catch {
      // Number already taken (shouldn't happen) or a parallel request issued
      // this order's invoice first: use theirs, otherwise try the next number.
      const again = await getInvoice(orderId);
      if (again) return again;
    }
  }
  throw new Error("Couldn't issue an invoice number.");
}
