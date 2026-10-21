import { NextRequest, NextResponse } from "next/server";
import { verifyItnSignature, validateWithPayfast } from "@/lib/payfast";
import { getOrder } from "@/lib/orders";
import { completePaidOrder, failOrder, holdForReview } from "@/lib/order-payment";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const data: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) data[k] = v;

  // 1. signature  2. PayFast's own server confirms the notice is genuine.
  // If our signature check disagrees but PayFast's server says VALID, the
  // payment is real (a forged notice can't get VALID) — accept it and log it,
  // so a paid order is never left stuck on "Pending payment".
  const sigOk = await verifyItnSignature(data);
  const valid = await validateWithPayfast(raw);
  if (!valid) {
    console.warn(`[payfast] ITN ${sigOk ? "failed PayFast validation" : "bad signature and not validated"}`, data.m_payment_id);
    return new NextResponse("not validated", { status: 400 });
  }
  if (!sigOk) console.warn("[payfast] ITN signature mismatch but PayFast validated it — accepting", data.m_payment_id);

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
    await holdForReview(id, { actor: "PayFast", pfPaymentId: data.pf_payment_id, reason: `PayFast reported R${gross} paid, but the order total is R${expected}.` });
    return new NextResponse("ok", { status: 200 });
  }

  const status = data.payment_status;
  if (status === "COMPLETE") {
    // Runs once per order even though PayFast retries the notice.
    await completePaidOrder(id, { paymentMethod: "payfast", pfPaymentId: data.pf_payment_id, actor: "PayFast", note: "Paid via PayFast" });
  } else if (status === "FAILED" || status === "CANCELLED") {
    await failOrder(id, { actor: "PayFast", pfPaymentId: data.pf_payment_id, note: `PayFast reported the payment ${status.toLowerCase()}` });
  } else {
    await holdForReview(id, { actor: "PayFast", pfPaymentId: data.pf_payment_id, reason: `PayFast reported the payment status as "${status}" (not yet complete).` });
  }

  return new NextResponse("ok", { status: 200 });
}
