import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { buildPaymentFields, payfastProcessUrl, isConfigured } from "@/lib/payfast";
import { cancelReasonsById } from "@/lib/cancel-reasons";
import { markPayfastSwitch } from "@/lib/order-payment";

// HappyPay didn't approve (or the application wasn't finished): the customer
// chose to pay for the SAME order with PayFast instead. The order keeps its
// number, items and total; only the payment method changes. The order id in
// the request is the private one from the customer's own payment links.
export async function POST(req: NextRequest) {
  let id = "";
  try { id = String(((await req.json()) as { id?: string }).id ?? "").trim(); } catch { /* empty */ }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const order = await getOrder(id);
  if (!order || order.paymentMethod !== "happypay") return NextResponse.json({ error: "This order can't be switched to PayFast." }, { status: 400 });
  if (Date.now() - new Date(order.createdAt).getTime() > 3 * 86400_000) return NextResponse.json({ error: "This order is too old — please check out again." }, { status: 400 });
  if (!["pending", "failed", "cancelled"].includes(order.status)) return NextResponse.json({ error: "This order is already being processed." }, { status: 400 });
  if (order.status === "cancelled") {
    // Only orders cancelled because HappyPay didn't go through (not by staff).
    const why = (await cancelReasonsById([id]))[id];
    if (!why || why.kind === "staff") return NextResponse.json({ error: "This order was cancelled — please check out again." }, { status: 400 });
  }
  if (!(await isConfigured())) return NextResponse.json({ error: "Card payments aren't available right now." }, { status: 503 });

  await updateOrder(id, { paymentMethod: "payfast", status: "pending" }, {
    actor: "Customer (website)",
    note: "HappyPay didn't approve, so the customer chose to pay for this order with PayFast instead",
  });
  await markPayfastSwitch(id); // the 1-hour PayFast hold starts now, not when the order was placed

  const envOrigin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  const origin = (
    envOrigin || (fwdHost && !/^(localhost|127\.|\[?::1\]?)/i.test(fwdHost) ? `${fwdProto}://${fwdHost}` : req.nextUrl.origin)
  ).replace(/\/+$/, "");

  const fields = await buildPaymentFields({
    mPaymentId: id,
    amount: order.totals.total / 100,
    itemName: `The Tyre Mall order ${order.reference}`,
    itemDescription: order.items.map((l) => `${l.name}${l.qty > 1 ? ` x${l.qty}` : ""}`).join(", "),
    nameFirst: order.customer.firstName,
    nameLast: order.customer.lastName,
    email: order.customer.email,
    cell: order.customer.phone,
    returnUrl: `${origin}/checkout/return?ref=${encodeURIComponent(order.reference)}`,
    cancelUrl: `${origin}/checkout/cancelled?id=${encodeURIComponent(id)}`,
    notifyUrl: `${origin}/api/payfast/notify`,
    customStr1: id,
  });
  return NextResponse.json({ processUrl: await payfastProcessUrl(), fields, reference: order.reference, total: order.totals.total });
}
