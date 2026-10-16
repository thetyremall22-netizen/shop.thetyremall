import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/catalogue";
import { computeTotals, type LineItem } from "@/lib/totals";
import { saveOrder, nextReference, type Order } from "@/lib/orders";
import { buildPaymentFields, PAYFAST_PROCESS_URL, isConfigured, PAYFAST_SANDBOX } from "@/lib/payfast";
import { getLive } from "@/lib/db/queries";
import { validateCoupon } from "@/lib/coupons";
import type { DeliveryMethod } from "@/lib/shop-config";

interface Body {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: Order["delivery"];
  items: { slug: string; qty: number; roadHazard?: boolean; alignment?: boolean; balanceQty?: number }[];
  paymentMethod: string;
  couponCode?: string;
}

export async function POST(req: NextRequest) {
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
      id: p.id, slug: p.slug, name: p.name, brand: p.brand, price: p.price, type: p.type,
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
    paymentMethod, test: paymentMethod === "payfast" && PAYFAST_SANDBOX, createdAt: now, updatedAt: now,
  };
  try {
    await saveOrder(order);
  } catch (e) {
    console.error("[checkout] saveOrder failed — proceeding to PayFast without a saved order:", (e as Error).message);
  }

  if (paymentMethod !== "payfast") {
    // HappyPay / Mobicred gateways come in a later step.
    return NextResponse.json({ gateway: false, reference, message: `${paymentMethod} is not wired up yet.` });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: "PayFast is not configured on the server." }, { status: 503 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const fields = buildPaymentFields({
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

  return NextResponse.json({ gateway: true, processUrl: PAYFAST_PROCESS_URL, fields, reference });
}
