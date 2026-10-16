import { NextRequest, NextResponse } from "next/server";
import { verifyItnSignature, validateWithPayfast } from "@/lib/payfast";
import { getOrder, updateOrder } from "@/lib/orders";
import { sendOrderPaid, sendOrderFailed } from "@/lib/email";
import { markRecovered } from "@/lib/abandoned";
import { decrementStock } from "@/lib/db/queries";
import { createWooOrder, wooWriteConfigured } from "@/lib/woo";
import { recordRedemption } from "@/lib/coupons";

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
    // The status guard makes this run exactly once per order (PayFast retries
    // the ITN, and the order is already "processing" on the second hit).
    if (order.status !== "processing" && order.status !== "completed") {
      const updated = await updateOrder(id, { status: "processing", pfPaymentId: data.pf_payment_id });
      if (updated) {
        // Headless WooCommerce: push the paid order into Woo so it records the
        // order, decrements ITS OWN stock, and sends its confirmation emails
        // (via the WordPress SMTP plugin — i.e. FluentSMTP → Microsoft 365,
        // which works because it sends from the WP server, not this one).
        let wooId: number | null = null;
        if (wooWriteConfigured()) {
          wooId = await createWooOrder(updated);
          if (wooId) console.log(`[woo] order ${updated.reference} created in Woo as #${wooId}`);
          else console.warn(`[woo] order ${updated.reference} NOT created in Woo — using local stock/email fallback`);
        }
        // When Woo owns the order it handles stock + emails. Otherwise fall
        // back to our own stock decrement + emailed confirmation (Resend/SMTP).
        if (!wooId) {
          for (const it of updated.items) await decrementStock(it.slug, it.qty);
          await sendOrderPaid(updated);
        }
        // Record a coupon redemption (bumps usage + enforces per-customer limits).
        if (updated.totals.couponCode && updated.totals.couponDiscount > 0) {
          await recordRedemption(updated.totals.couponCode, updated.reference, updated.customer.email, updated.totals.couponDiscount).catch(() => {});
        }
        // Cart was recovered — don't chase it.
        await markRecovered(updated.customer.email).catch(() => {});
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
