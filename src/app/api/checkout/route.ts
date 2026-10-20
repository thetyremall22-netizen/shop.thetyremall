import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/catalogue";
import { computeTotals, type LineItem } from "@/lib/totals";
import { saveOrder, nextReference, updateOrder, type Order } from "@/lib/orders";
import { buildPaymentFields, payfastProcessUrl, isConfigured, isSandbox } from "@/lib/payfast";
import { createHappyPayOrder, isEnabled as happyPayEnabled } from "@/lib/happypay";
import { getLive, decrementStock } from "@/lib/db/queries";
import { validateCoupon, recordRedemption } from "@/lib/coupons";
import { sendOrderPaid } from "@/lib/email";
import { markRecovered } from "@/lib/abandoned";
import { getSettings } from "@/lib/settings";
import { addAudit } from "@/lib/audit";
import type { DeliveryMethod } from "@/lib/shop-config";

interface Body {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: Order["delivery"];
  items: { slug: string; qty: number; roadHazard?: boolean; alignment?: boolean; balanceQty?: number }[];
  paymentMethod: string;
  couponCode?: string;
}

export async function POST(req: NextRequest) {
  // Block all orders while the store is in maintenance / "coming soon" mode.
  try {
    const s = await getSettings();
    if (s.maintenance.enabled) {
      return NextResponse.json({ error: "Our store is not taking orders just yet — please check back soon." }, { status: 503 });
    }
  } catch { /* fail open — don't block checkout on a settings read error */ }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { customer, delivery, items, paymentMethod } = body;
  if (!customer?.email || !customer.firstName || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Re-price every line from the server catalogue — never trust client prices.
  const lines: LineItem[] = [];
  for (const it of items) {
    const p = await getProduct(it.slug);
    if (!p) continue;
    lines.push({
      id: p.id, slug: p.slug, name: p.name, brand: p.brand, sku: p.sku || undefined, price: p.price, type: p.type,
      qty: Math.max(1, Math.min(99, Math.floor(it.qty || 1))),
      roadHazard: !!it.roadHazard, alignment: !!it.alignment,
      balanceQty: Math.max(0, Math.min(8, Math.floor(it.balanceQty ?? 0))),
    });
  }
  if (!lines.length) return NextResponse.json({ error: "No valid items" }, { status: 400 });

  // Live stock check against our database — prevents overselling.
  for (const l of lines) {
    const liveStock = await getLive(l.slug);
    if (liveStock && !liveStock.inStock) {
      return NextResponse.json({ error: `Sorry, "${l.name}" just went out of stock. Please remove it and try again.` }, { status: 409 });
    }
    if (liveStock?.lowStockRemaining != null && l.qty > liveStock.lowStockRemaining) {
      return NextResponse.json({ error: `Only ${liveStock.lowStockRemaining} of "${l.name}" left — please reduce the quantity.` }, { status: 409 });
    }
  }

  const method: DeliveryMethod = delivery?.method === "fitment" ? "fitment" : "delivery";

  // Re-validate any coupon server-side (never trust a client-sent discount).
  let coupon: { code: string; discount: number } | undefined;
  if (body.couponCode) {
    const cr = await validateCoupon(body.couponCode, {
      items: lines.map((l) => ({ slug: l.slug, price: l.price, qty: l.qty, type: l.type })),
      email: customer.email,
    });
    if (cr.valid && cr.discount && cr.code) coupon = { code: cr.code, discount: cr.discount };
  }

  const totals = computeTotals(lines, method, coupon);

  // Order persistence is best-effort: if the database isn't available yet
  // (e.g. before Turso is connected on Vercel) we still let the customer pay —
  // we just can't record the order until the DB is set up.
  let reference: string;
  try {
    reference = await nextReference();
  } catch {
    reference = `TTM-${1000 + (Date.now() % 100000)}`;
  }
  const id = `${reference}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const order: Order = {
    id, reference, status: "pending",
    customer, delivery: { ...delivery, method }, items: lines, totals,
    // Sandbox PayFast => test order (labelled apart from real orders in admin).
    paymentMethod, test: paymentMethod === "payfast" && (await isSandbox()), createdAt: now, updatedAt: now,
  };
  try {
    await saveOrder(order);
    await addAudit({
      entity: "order", entityId: id, action: "created", actor: "Customer (website)",
      summary: `Order placed online — ${lines.reduce((n, l) => n + l.qty, 0)} item(s), R${(totals.total / 100).toFixed(2)}, paying by ${paymentMethod}`,
    });
  } catch (e) {
    console.error("[checkout] saveOrder failed — proceeding to PayFast without a saved order:", (e as Error).message);
  }

  // Public base URL for return/notify/webhook links. Behind the Nginx Unit +
  // LiteSpeed proxy, req.nextUrl.origin is the app's INTERNAL address
  // (localhost:PORT), which breaks PayFast/HappyPay callbacks and the free-order
  // redirect. Prefer an explicit env (SITE_URL, read at runtime so it's not
  // frozen at build), then the proxy's forwarded host, and only fall back to the
  // request origin when that isn't a local address.
  const envOrigin = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const fwdHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const fwdProto = req.headers.get("x-forwarded-proto") || "https";
  const origin = (
    envOrigin ||
    (fwdHost && !/^(localhost|127\.|\[?::1\]?)/i.test(fwdHost) ? `${fwdProto}://${fwdHost}` : req.nextUrl.origin)
  ).replace(/\/+$/, "");

  // --- Free order (e.g. a 100%-off coupon): no gateway, mark paid directly ---
  if (totals.total === 0) {
    const updated = await updateOrder(id, { status: "processing", paymentMethod: "coupon" });
    const paidOrder = updated ?? order;
    for (const it of paidOrder.items) await decrementStock(it.slug, it.qty);
    await sendOrderPaid(paidOrder).catch((e) => console.error("[checkout] free-order email failed", e));
    if (paidOrder.totals.couponCode && paidOrder.totals.couponDiscount > 0) {
      await recordRedemption(paidOrder.totals.couponCode, paidOrder.reference, paidOrder.customer.email, paidOrder.totals.couponDiscount).catch(() => {});
    }
    await markRecovered(paidOrder.customer.email).catch(() => {});
    return NextResponse.json({ gateway: "free", reference, redirectUrl: `${origin}/checkout/return?ref=${encodeURIComponent(reference)}` });
  }

  // --- HappyPay (BNPL): create an order and redirect the customer there ---
  if (paymentMethod === "happypay") {
    if (!(await happyPayEnabled())) {
      return NextResponse.json({ gateway: false, reference, message: "HappyPay isn't available right now." });
    }
    const hp = await createHappyPayOrder({ orderId: id, reference, totalCents: totals.total, origin, email: customer.email });
    if (!hp.ok || !hp.redirectUrl) {
      return NextResponse.json({ error: hp.error ?? "Couldn't start HappyPay." }, { status: 502 });
    }
    return NextResponse.json({ gateway: true, redirectUrl: hp.redirectUrl, reference });
  }

  if (paymentMethod !== "payfast") {
    return NextResponse.json({ gateway: false, reference, message: `${paymentMethod} is not wired up yet.` });
  }
  if (!(await isConfigured())) {
    return NextResponse.json({ error: "PayFast is not configured on the server." }, { status: 503 });
  }

  const fields = await buildPaymentFields({
    mPaymentId: id,
    amount: totals.total / 100,
    itemName: `The Tyre Mall order ${reference}`,
    itemDescription: lines.map((l) => `${l.name}${l.qty > 1 ? ` x${l.qty}` : ""}`).join(", "),
    nameFirst: customer.firstName,
    nameLast: customer.lastName,
    email: customer.email,
    cell: customer.phone,
    returnUrl: `${origin}/checkout/return?ref=${encodeURIComponent(reference)}`,
    cancelUrl: `${origin}/checkout/cancelled?id=${encodeURIComponent(id)}`,
    notifyUrl: `${origin}/api/payfast/notify`,
    customStr1: id,
  });

  return NextResponse.json({ gateway: true, processUrl: await payfastProcessUrl(), fields, reference });
}
