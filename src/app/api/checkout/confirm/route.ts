import { NextRequest, NextResponse, connection } from "next/server";
import { libsql } from "@/lib/db";
import { recheckHappyPayOrder, notePayfastReturn } from "@/lib/order-payment";

// The "thank you" page calls this when the customer comes back from paying.
// - HappyPay: ask HappyPay now, so an approved order is confirmed straight away
//   even if HappyPay's callback is slow or never arrives.
// - PayFast: PayFast only sends people back here after a successful payment, so
//   note it; if PayFast's own confirmation hasn't arrived within 10 minutes the
//   shop is alerted (see watchPayfastReturns). Neither can mark an order paid
//   by itself.
export async function POST(req: NextRequest) {
  await connection();
  let ref = "";
  try { ref = String((await req.json()).ref ?? "").trim().toUpperCase(); } catch { /* ignore */ }
  if (!/^TTM-\d+$/.test(ref)) return NextResponse.json({ ok: false });
  const r = await libsql.execute({
    sql: "SELECT order_id, status, payment_method FROM orders WHERE reference = ? AND created_at >= ? ORDER BY id DESC LIMIT 1",
    args: [ref, Date.now() - 86400_000],
  });
  const row = r.rows[0];
  if (!row || !["pending", "on-hold"].includes(String(row.status))) return NextResponse.json({ ok: true });
  if (String(row.payment_method) === "happypay") await recheckHappyPayOrder(String(row.order_id), "HappyPay (client returned)");
  else if (String(row.payment_method) === "payfast") await notePayfastReturn(String(row.order_id));
  return NextResponse.json({ ok: true });
}
