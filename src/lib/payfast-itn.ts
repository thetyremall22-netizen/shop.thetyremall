import "server-only";
import { libsql } from "./db";

// Every genuine (PayFast-validated) payment notice PayFast sends us, kept as
// received, so the admin can see exactly what PayFast reported for an order:
// status, amount, PayFast's fee (which differs by payment method) and any
// payment-method detail PayFast includes. New table; orders aren't changed.

export interface PayfastNotice {
  id: number;
  orderId: string;
  pfPaymentId: string;
  status: string;
  amountGross: number | null;
  amountFee: number | null;
  amountNet: number | null;
  /** Every field PayFast sent except the signature (and our merchant id). */
  fields: Record<string, string>;
  receivedAt: number;
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS payfast_itn (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    pf_payment_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    amount_gross REAL,
    amount_fee REAL,
    amount_net REAL,
    fields TEXT NOT NULL DEFAULT '{}',
    received_at INTEGER NOT NULL
  )`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS payfast_itn_order ON payfast_itn (order_id)`);
  ensured = true;
}

const num = (v: string | undefined) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Save one validated notice (PayFast resends the same notice; identical repeats are skipped). */
export async function saveItn(orderId: string, data: Record<string, string>): Promise<void> {
  try {
    await ensureTable();
    const fields = Object.fromEntries(Object.entries(data).filter(([k]) => k !== "signature" && k !== "merchant_id"));
    const json = JSON.stringify(fields);
    const dup = await libsql.execute({ sql: "SELECT 1 FROM payfast_itn WHERE order_id = ? AND fields = ? LIMIT 1", args: [orderId, json] });
    if (dup.rows.length) return;
    await libsql.execute({
      sql: `INSERT INTO payfast_itn (order_id, pf_payment_id, status, amount_gross, amount_fee, amount_net, fields, received_at) VALUES (?,?,?,?,?,?,?,?)`,
      args: [orderId, data.pf_payment_id ?? "", data.payment_status ?? "", num(data.amount_gross), num(data.amount_fee), num(data.amount_net), json, Date.now()],
    });
  } catch (e) {
    console.error("[payfast] saving notice failed:", (e as Error).message);
  }
}

export async function listItnForOrder(orderId: string): Promise<PayfastNotice[]> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM payfast_itn WHERE order_id = ? ORDER BY id", args: [orderId] });
    return r.rows.map((x) => ({
      id: Number(x.id), orderId: String(x.order_id), pfPaymentId: String(x.pf_payment_id ?? ""), status: String(x.status ?? ""),
      amountGross: x.amount_gross == null ? null : Number(x.amount_gross),
      amountFee: x.amount_fee == null ? null : Number(x.amount_fee),
      amountNet: x.amount_net == null ? null : Number(x.amount_net),
      fields: (() => { try { return JSON.parse(String(x.fields || "{}")) as Record<string, string>; } catch { return {}; } })(),
      receivedAt: Number(x.received_at),
    }));
  } catch {
    return [];
  }
}
