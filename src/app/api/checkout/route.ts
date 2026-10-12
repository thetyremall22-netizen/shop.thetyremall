import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/catalogue";
import { computeTotals, type LineItem } from "@/lib/totals";
import { saveOrder, nextReference, type Order } from "@/lib/orders";
import { buildPaymentFields, PAYFAST_PROCESS_URL, isConfigured } from "@/lib/payfast";
import { getLive } from "@/lib/db/queries";
import type { DeliveryMethod } from "@/lib/shop-config";

interface Body {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: Order["delivery"];
  items: { slug: string; qty: number; roadHazard?: boolean; alignment?: boolean; balanceQty?: number }[];
  paymentMethod: string;
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
  const totals = computeTotals(lines, method);

  const reference = await nextReference();
  const id = `${reference}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const order: Order = {
    id, reference, status: "pending",
    customer, delivery: { ...delivery, method }, items: lines, totals,
    paymentMethod, createdAt: now, updatedAt: now,
  };
  await saveOrder(order);

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
