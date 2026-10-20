import { NextRequest, NextResponse, connection } from "next/server";
import { libsql } from "@/lib/db";
import { recheckHappyPayOrder } from "@/lib/order-payment";

// The "thank you" page calls this when the client comes back from HappyPay,
// so an approved order is confirmed straight away even if HappyPay's callback
// is slow or never arrives. It only ever asks HappyPay — it can't mark anything
// paid by itself.
export async function POST(req: NextRequest) {
  await connection();
  let ref = "";
  try { ref = String((await req.json()).ref ?? "").trim().toUpperCase(); } catch { /* ignore */ }
  if (!/^TTM-\d+$/.test(ref)) return NextResponse.json({ ok: false });
  const r = await libsql.execute({
    sql: "SELECT order_id, status FROM orders WHERE reference = ? AND payment_method = 'happypay' AND created_at >= ? ORDER BY id DESC LIMIT 1",
    args: [ref, Date.now() - 86400_000],
  });
  const row = r.rows[0];
  if (!row) return NextResponse.json({ ok: true });
  if (["pending", "on-hold"].includes(String(row.status))) await recheckHappyPayOrder(String(row.order_id), "HappyPay (client returned)");
  return NextResponse.json({ ok: true });
}
