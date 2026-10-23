import { NextRequest, NextResponse, connection } from "next/server";
import { libsql } from "@/lib/db";

// The "thank you" page asks this whether an order's payment is confirmed, so it
// only reports a sale to Google Ads / Analytics once it's really paid. Needs the
// order reference AND the buyer's email (both only known to the buyer's own
// browser) and returns nothing personal: just the payment state and total.
export async function POST(req: NextRequest) {
  await connection();
  let ref = "", email = "";
  try {
    const b = await req.json();
    ref = String(b.ref ?? "").trim().toUpperCase();
    email = String(b.email ?? "").trim().toLowerCase();
  } catch { /* ignore */ }
  if (!/^TTM-\d+$/.test(ref) || !email) return NextResponse.json({ state: "unknown" });
  const r = await libsql.execute({
    sql: `SELECT status, payment_method, json_extract(totals, '$.total') total FROM orders
          WHERE reference = ? AND LOWER(json_extract(customer, '$.email')) = ? AND created_at >= ?
          ORDER BY id DESC LIMIT 1`,
    args: [ref, email, Date.now() - 2 * 86400_000],
  });
  const row = r.rows[0];
  if (!row) return NextResponse.json({ state: "unknown" });
  const status = String(row.status);
  const state = ["processing", "completed"].includes(status) ? "paid"
    : ["pending", "on-hold"].includes(status) ? "pending" : "not_paid";
  return NextResponse.json({ state, method: String(row.payment_method ?? ""), total: Number(row.total) || 0 });
}
