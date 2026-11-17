import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { sendOrderCancelled } from "@/lib/email";
import { isConfigured as payfastReady } from "@/lib/payfast";

// The customer came back from the payment page without paying (the gateway's
// cancel / not-approved return link). Cancels an order that never completed
// payment. HappyPay: no cancellation email, because the page offers to pay for
// the same order with PayFast instead (the order can still be switched).
export async function POST(req: NextRequest) {
  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const order = await getOrder(id);
  if (!order) return NextResponse.json({ ok: true });
  const happypay = order.paymentMethod === "happypay";
  // Only cancel orders that never completed payment.
  if (order.status === "pending") {
    const updated = await updateOrder(id, { status: "cancelled" });
    if (updated && !happypay) await sendOrderCancelled(updated);
  }
  const fresh = await getOrder(id);
  const canSwitch = happypay && !!fresh && ["pending", "cancelled", "failed"].includes(fresh.status) && (await payfastReady());
  return NextResponse.json({
    ok: true,
    method: order.paymentMethod,
    canSwitch,
    ...(canSwitch && fresh ? { reference: fresh.reference, total: fresh.totals.total } : {}),
  });
}
