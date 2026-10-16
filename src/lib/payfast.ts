import "server-only";
import crypto from "crypto";
import { getGatewayRuntime } from "./payments";

// PayFast config resolves from the admin Settings → Payments store first, then
// falls back to environment variables — so credentials can be changed from the
// admin without a redeploy, while existing env-based setups keep working.
interface PfConfig { sandbox: boolean; merchantId: string; merchantKey: string; passphrase: string }

async function resolve(): Promise<PfConfig> {
  const envSandbox = (process.env.PAYFAST_SANDBOX ?? "true") !== "false";
  let row: Awaited<ReturnType<typeof getGatewayRuntime>> = null;
  try { row = await getGatewayRuntime("payfast"); } catch { /* fall back to env */ }
  const c = row?.config ?? {};
  return {
    sandbox: row ? row.mode !== "live" : envSandbox,
    merchantId: c.merchantId || process.env.PAYFAST_MERCHANT_ID || "",
    merchantKey: c.merchantKey || process.env.PAYFAST_MERCHANT_KEY || "",
    passphrase: c.passphrase || process.env.PAYFAST_PASSPHRASE || "",
  };
}

const processUrlFor = (sandbox: boolean) => (sandbox ? "https://sandbox.payfast.co.za/eng/process" : "https://www.payfast.co.za/eng/process");
const validateUrlFor = (sandbox: boolean) => (sandbox ? "https://sandbox.payfast.co.za/eng/query/validate" : "https://www.payfast.co.za/eng/query/validate");

export async function isSandbox(): Promise<boolean> { return (await resolve()).sandbox; }
export async function payfastProcessUrl(): Promise<string> { return processUrlFor((await resolve()).sandbox); }
export async function isConfigured(): Promise<boolean> { const c = await resolve(); return Boolean(c.merchantId && c.merchantKey); }

/** PayFast urlencoding: uppercase hex, spaces as "+", matching their PHP example. */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+").replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/** MD5 signature over fields in insertion order, excluding "signature", passphrase last. */
export function signature(fields: Record<string, string>, passphrase = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "signature") continue;
    if (v === undefined || v === null || `${v}` === "") continue;
    parts.push(`${k}=${pfEncode(`${v}`)}`);
  }
  let base = parts.join("&");
  if (passphrase) base += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash("md5").update(base).digest("hex");
}

export interface PayfastPaymentInput {
  mPaymentId: string;
  amount: number; // rands (major units) e.g. 4229.00
  itemName: string;
  itemDescription?: string;
  nameFirst?: string;
  nameLast?: string;
  email?: string;
  cell?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customStr1?: string;
}

/** Ordered field set + signature for the redirect form POST to PayFast. */
export async function buildPaymentFields(p: PayfastPaymentInput): Promise<Record<string, string>> {
  const c = await resolve();
  const fields: Record<string, string> = {
    merchant_id: c.merchantId,
    merchant_key: c.merchantKey,
    return_url: p.returnUrl,
    cancel_url: p.cancelUrl,
    notify_url: p.notifyUrl,
  };
  if (p.nameFirst) fields.name_first = p.nameFirst;
  if (p.nameLast) fields.name_last = p.nameLast;
  if (p.email) fields.email_address = p.email;
  if (p.cell) fields.cell_number = p.cell;
  fields.m_payment_id = p.mPaymentId;
  fields.amount = p.amount.toFixed(2);
  fields.item_name = p.itemName.slice(0, 100);
  if (p.itemDescription) fields.item_description = p.itemDescription.slice(0, 255);
  if (p.customStr1) fields.custom_str1 = p.customStr1;
  fields.signature = signature(fields, c.passphrase);
  return fields;
}

/** Verify the signature on an ITN (notify) payload. */
export async function verifyItnSignature(data: Record<string, string>): Promise<boolean> {
  const posted = data.signature ?? "";
  const calc = signature(data, (await resolve()).passphrase);
  return posted.length === calc.length && crypto.timingSafeEqual(Buffer.from(posted), Buffer.from(calc));
}

/** Server-to-server confirmation that the ITN genuinely came from PayFast. */
export async function validateWithPayfast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(validateUrlFor((await resolve()).sandbox), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    return (await res.text()).trim() === "VALID";
  } catch {
    return false;
  }
}
