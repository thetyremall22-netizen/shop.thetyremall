import { NextRequest, NextResponse, connection } from "next/server";
import { verifyWebhookSecret, fetchHappyPayStatus } from "@/lib/happypay";
import { getOrder } from "@/lib/orders";
import { completePaidOrder, failOrder, holdForReview, classifyHappyPayStatus } from "@/lib/order-payment";

export const maxDuration = 60;

// HappyPay calls this (with our secret) when a client's application is
// approved (r=ok) or not (r=fail).
async function handle(req: NextRequest) {
  await connection();
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id") || "";
  const secret = url.searchParams.get("secret") || "";
  const result = url.searchParams.get("r") || "ok";

  if (!(await verifyWebhookSecret(secret))) {
    console.warn("[happypay] notify with a wrong secret for", orderId);
    return new NextResponse("invalid secret", { status: 401 });
  }
  const order = await getOrder(orderId);
  if (!order) return new NextResponse("ok", { status: 200 }); // ack unknown orders

  if (result === "fail") {
    await failOrder(orderId, { actor: "HappyPay", note: "HappyPay reported the application was not approved" });
    return new NextResponse("ok", { status: 200 });
  }

  // Approved. Double-check with HappyPay; only an explicit "not paid" answer
  // (declined / cancelled / expired …) stops it. If HappyPay can't be reached
  // or uses wording we don't recognise, the secret-verified callback is trusted.
  const hp = await fetchHappyPayStatus(orderId);
  const verdict = classifyHappyPayStatus(hp?.status);
  console.log(`[happypay] ${order.reference} approved callback; HappyPay status: ${hp?.status ?? "(unreachable)"} → ${verdict}`);
  if (verdict === "not_paid") {
    await holdForReview(orderId, { actor: "HappyPay", reason: `HappyPay sent an "approved" notice, but when we checked, HappyPay's status for this order was "${hp?.status}". Please confirm in the HappyPay merchant portal.` });
  } else {
    await completePaidOrder(orderId, {
      paymentMethod: "happypay", actor: "HappyPay",
      note: `Approved by HappyPay${hp?.status ? ` (HappyPay status: ${hp.status})` : ""}`,
    });
  }
  return new NextResponse("ok", { status: 200 });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
