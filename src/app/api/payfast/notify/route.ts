import { NextRequest, NextResponse } from "next/server";
import { verifyItnSignature, validateWithPayfast } from "@/lib/payfast";
import { getOrder, updateOrder } from "@/lib/orders";
import { sendOrderPaid, sendOrderFailed } from "@/lib/email";
import { decrementStock } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const data: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) data[k] = v;

  // 1. signature
  if (!verifyItnSignature(data)) {
    console.warn("[payfast] ITN bad signature", data.m_payment_id);
    return new NextResponse("invalid signature", { status: 400 });
  }
  // 2. server-to-server authenticity check
  const valid = await validateWithPayfast(raw);
  if (!valid) {
    console.warn("[payfast] ITN failed PayFast validation", data.m_payment_id);
    return new NextResponse("not validated", { status: 400 });
  }

  const id = data.custom_str1 || data.m_payment_id;
  const order = await getOrder(id);
  if (!order) {
    console.warn("[payfast] ITN for unknown order", id);
    return new NextResponse("ok", { status: 200 }); // 200 so PayFast stops retrying
  }

  // 3. amount matches (gross in rands vs our minor units)
  const expected = (order.totals.total / 100).toFixed(2);
  const gross = Number(data.amount_gross ?? 0).toFixed(2);
  if (expected !== gross) {
    console.warn(`[payfast] amount mismatch order ${id}: expected ${expected} got ${gross}`);
    await updateOrder(id, { status: "on-hold", pfPaymentId: data.pf_payment_id });
    return new NextResponse("ok", { status: 200 });
  }

  const status = data.payment_status;
  if (status === "COMPLETE") {
    if (order.status !== "processing" && order.status !== "completed") {
      const updated = await updateOrder(id, { status: "processing", pfPaymentId: data.pf_payment_id });
      if (updated) {
        // Decrement stock in our database, then send the order emails.
        for (const it of updated.items) await decrementStock(it.slug, it.qty);
        await sendOrderPaid(updated);
      }
    }
  } else if (status === "FAILED") {
    const updated = await updateOrder(id, { status: "failed", pfPaymentId: data.pf_payment_id });
    if (updated) await sendOrderFailed(updated);
  } else {
    await updateOrder(id, { status: "on-hold", pfPaymentId: data.pf_payment_id });
  }

  return new NextResponse("ok", { status: 200 });
}
