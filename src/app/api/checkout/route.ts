import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getProduct } from "@/lib/catalogue";
import { computeTotals, type LineItem } from "@/lib/totals";
import { saveOrder, nextReference, setOrderAttribution, type Order } from "@/lib/orders";
import { sanitizeAttribution, deviceFromUA } from "@/lib/attribution";
import { buildPaymentFields, payfastProcessUrl, isConfigured, isSandbox } from "@/lib/payfast";
import { createHappyPayOrder, isEnabled as happyPayEnabled } from "@/lib/happypay";
import { getLive } from "@/lib/db/queries";
import { validateCoupon } from "@/lib/coupons";
import { completePaidOrder } from "@/lib/order-payment";
import { getSettingsFresh } from "@/lib/settings";
import { addAudit } from "@/lib/audit";
import type { DeliveryMethod } from "@/lib/shop-config";
import { saProvince, isSaPostalCode, SA_DELIVERY_ERROR } from "@/lib/sa-address";

interface Body {
  customer: { firstName: string; lastName: string; email: string; phone: string };
  delivery: Order["delivery"];
  items: { slug: string; qty: number; roadHazard?: boolean; alignment?: boolean; balanceQty?: number }[];
  paymentMethod: string;
  couponCode?: string;
  attribution?: unknown;
}

export async function POST(req: NextRequest) {
  // Block all orders while the store is in maintenance / "coming soon" mode.
  try {
    const s = await getSettingsFresh(); // live value, never a cached copy
    // Logged-in staff can still place (TEST) orders to check checkout.
    if (s.maintenance.enabled && !(await isAdmin())) {
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

  // We only deliver within South Africa (customers in neighbouring countries
  // can buy, but the delivery address must be South African).
  if (method === "delivery") {
    const a = delivery?.address;
    const province = saProvince(a?.province);
    if (!a || !a.street?.trim() || !a.city?.trim() || !province || !isSaPostalCode(a.postalCode)) {
      return NextResponse.json({ error: SA_DELIVERY_ERROR }, { status: 400 });
    }
    delivery.address = { ...a, province, postalCode: a.postalCode.trim() };
  }

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
  } catch (e) {
    // Last resort only: a long, time-based number that can't repeat.
    console.error("[checkout] order counter failed:", (e as Error).message);
    reference = `TTM-${Date.now().toString().slice(-9)}`;
  }
  const id = `${reference}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const staff = await isAdmin();
  const order: Order = {
    id, reference, status: "pending",
    customer, delivery: { ...delivery, method }, items: lines, totals,
    // Sandbox PayFast => test order (labelled apart from real orders in admin).
    // Test order: PayFast sandbox, or placed while logged in to the admin.
    paymentMethod, test: (paymentMethod === "payfast" && (await isSandbox())) || staff, createdAt: now, updatedAt: now,
  };
  try {
    await saveOrder(order);
    // Where the sale came from (Google Ads, search, AI, social…), for Admin → Orders.
    const attr = sanitizeAttribution(body.attribution) ?? { touch: { at: Date.now(), referrer: "", landing: "", utm: {}, clickIds: {} }, sessionPages: 0, visits: 0 };
    await setOrderAttribution(id, { ...attr, device: deviceFromUA(req.headers.get("user-agent") ?? ""), ...(staff ? { staff: true } : {}) }).catch((e) => console.error("[checkout] attribution not saved:", (e as Error).message));
    await addAudit({
      entity: "order", entityId: id, action: "created", actor: "Customer (website)",
      summary: `Order placed online — ${lines.reduce((n, l) => n + l.qty, 0)} item(s), R${(totals.total / 100).toFixed(2)}, paying by ${totals.total === 0 ? "coupon (nothing to pay)" : paymentMethod}`,
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
    // Saved as a normal order, set to Processing, with the usual client + shop emails.
    await completePaidOrder(id, {
      paymentMethod: "coupon", actor: "Coupon",
      note: `Nothing to pay — coupon ${order.totals.couponCode ?? ""} covered the full amount`.replace("  ", " "),
    });
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
