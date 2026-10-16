import "server-only";
import crypto from "crypto";
import { getGatewayRuntime } from "./payments";

// HappyPay BNPL adapter — https://widgets.happypay.co.za/api.htm
// Flow: createOrder -> redirect customer to HappyPay -> they apply/pay ->
// HappyPay calls our webhook (with our secret) and redirects back. We confirm
// the order status via MerchantExportJSON before marking it paid.

interface HpConfig { test: boolean; merchantId: string; apiKey: string; webhookSecret: string; months: number }

async function resolve(): Promise<HpConfig | null> {
  const row = await getGatewayRuntime("happypay");
  if (!row) return null;
  const c = row.config;
  return {
    test: row.mode !== "live",
    merchantId: c.merchantId || "",
    apiKey: c.apiKey || "",
    webhookSecret: c.webhookSecret || "",
    months: Number(c.months) || 2,
  };
}

const baseFor = (test: boolean) => (test ? "https://qa.happypay.co.za" : "https://happypay.co.za");
const rands = (cents: number) => (cents / 100).toFixed(2);

export async function isEnabled(): Promise<boolean> {
  const row = await getGatewayRuntime("happypay");
  return !!(row?.enabled && row.config.merchantId && row.config.apiKey);
}
export async function monthsLabel(): Promise<number> {
  const c = await resolve();
  return c?.months ?? 2;
}

export interface HappyPayInit {
  orderId: string;
  reference: string;
  totalCents: number;
  origin: string; // e.g. https://thetyremall.co.za
  email?: string;
}

/** Create a HappyPay order; returns the URL to redirect the customer to. */
export async function createHappyPayOrder(p: HappyPayInit): Promise<{ ok: boolean; redirectUrl?: string; error?: string }> {
  const c = await resolve();
  if (!c || !c.merchantId || !c.apiKey) return { ok: false, error: "HappyPay is not configured." };
  const base = baseFor(c.test);
  const secret = encodeURIComponent(c.webhookSecret);
  const oid = encodeURIComponent(p.orderId);
  const body = {
    id: p.orderId,
    APIKey: c.apiKey,
    total: rands(p.totalCents),
    products: [{ quantity: 1, price: Number(rands(p.totalCents)), name: `The Tyre Mall order ${p.reference}` }],
    currency: "ZAR",
    successWebhook: `${p.origin}/api/happypay/notify?order_id=${oid}&secret=${secret}&r=ok`,
    failureWebhook: `${p.origin}/api/happypay/notify?order_id=${oid}&secret=${secret}&r=fail`,
    successReturnUrl: `${p.origin}/checkout/return?ref=${encodeURIComponent(p.reference)}`,
    failReturnUrl: `${p.origin}/checkout/cancelled?id=${oid}`,
    merchantId: c.merchantId,
    test: c.test,
  };
  try {
    const res = await fetch(`${base}/api/ServicesV1.asmx/createOrder`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { d?: { redirectUrl?: string; success?: boolean; errorMessage?: string } };
    const d = data.d;
    if (d?.success && d.redirectUrl) return { ok: true, redirectUrl: d.redirectUrl };
    return { ok: false, error: d?.errorMessage || "HappyPay didn't accept the order." };
  } catch (e) {
    return { ok: false, error: `Couldn't reach HappyPay: ${(e as Error).message}` };
  }
}

/** Constant-time check of the webhook secret supplied in the callback URL. */
export async function verifyWebhookSecret(supplied: string): Promise<boolean> {
  const c = await resolve();
  if (!c || !c.webhookSecret) return false;
  const a = Buffer.from(supplied || "");
  const b = Buffer.from(c.webhookSecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Confirm an order's real status with HappyPay (defence against spoofed webhooks). */
export async function fetchHappyPayStatus(orderId: string): Promise<{ status: string; isTest: boolean; total: string } | null> {
  const c = await resolve();
  if (!c) return null;
  try {
    const res = await fetch(`${baseFor(c.test)}/api/MerchantExportJSON.ashx`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: c.apiKey, merchantId: c.merchantId, type: "Order", orderId }),
    });
    const d = (await res.json().catch(() => null)) as { status?: string; isTest?: boolean; totalPrice?: string } | null;
    if (!d || !d.status) return null;
    return { status: String(d.status), isTest: !!d.isTest, total: String(d.totalPrice ?? "") };
  } catch { return null; }
}

/** Refund a HappyPay order (used from the admin order detail later). */
export async function refundHappyPayOrder(orderId: string, totalCents: number, reason: string): Promise<{ ok: boolean; error?: string }> {
  const c = await resolve();
  if (!c) return { ok: false, error: "HappyPay is not configured." };
  try {
    const res = await fetch(`${baseFor(c.test)}/api/ServicesV1.asmx/createRefund`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: c.merchantId, APIKey: c.apiKey, orderId, total: rands(totalCents), reason }),
    });
    const data = (await res.json().catch(() => ({}))) as { d?: { Success?: boolean; ErrorMessage?: string } };
    if (data.d?.Success) return { ok: true };
    return { ok: false, error: data.d?.ErrorMessage || "Refund failed." };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
