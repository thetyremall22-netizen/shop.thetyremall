import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret, fetchHappyPayStatus } from "@/lib/happypay";
import { getOrder, updateOrder } from "@/lib/orders";
import { decrementStock } from "@/lib/db/queries";
import { sendOrderPaid, sendOrderFailed } from "@/lib/email";
import { recordRedemption } from "@/lib/coupons";
import { markRecovered } from "@/lib/abandoned";

export const maxDuration = 60;

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id") || "";
  const secret = url.searchParams.get("secret") || "";
  const result = url.searchParams.get("r") || "ok";

  if (!(await verifyWebhookSecret(secret))) {
    return new NextResponse("invalid secret", { status: 401 });
  }
  const order = await getOrder(orderId);
  if (!order) return new NextResponse("ok", { status: 200 }); // ack unknown orders

  if (result === "fail") {
    if (order.status === "pending") {
      const updated = await updateOrder(orderId, { status: "failed" });
      if (updated) await sendOrderFailed(updated).catch(() => {});
    }
    return new NextResponse("ok", { status: 200 });
  }

  // Success: confirm the real status with HappyPay before marking paid.
  const status = await fetchHappyPayStatus(orderId);
  const confirmed = !status || /complete|paid|success/i.test(status.status); // trust secret-verified webhook if export is unreachable
  if (!confirmed) {
    await updateOrder(orderId, { status: "on-hold" });
    return new NextResponse("ok", { status: 200 });
  }

  // Idempotent paid flow (HappyPay-only — no WooCommerce).
  if (order.status !== "processing" && order.status !== "completed") {
    const updated = await updateOrder(orderId, { status: "processing", paymentMethod: "happypay" });
    if (updated) {
      for (const it of updated.items) await decrementStock(it.slug, it.qty);
      await sendOrderPaid(updated).catch(() => {});
      if (updated.totals.couponCode && updated.totals.couponDiscount > 0) {
        await recordRedemption(updated.totals.couponCode, updated.reference, updated.customer.email, updated.totals.couponDiscount).catch(() => {});
      }
      await markRecovered(updated.customer.email).catch(() => {});
    }
  }
  return new NextResponse("ok", { status: 200 });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
