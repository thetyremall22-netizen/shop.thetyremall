import "server-only";
import crypto from "crypto";

const SANDBOX = (process.env.PAYFAST_SANDBOX ?? "true") !== "false";

export const PAYFAST_PROCESS_URL = SANDBOX
  ? "https://sandbox.payfast.co.za/eng/process"
  : "https://www.payfast.co.za/eng/process";

const VALIDATE_URL = SANDBOX
  ? "https://sandbox.payfast.co.za/eng/query/validate"
  : "https://www.payfast.co.za/eng/query/validate";

export const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? "";
export const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? "";
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? "";

/** PayFast urlencoding: uppercase hex, spaces as "+", matching their PHP example. */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+").replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Build the MD5 signature over the given fields *in their given order*
 * (insertion order), excluding "signature", appending the passphrase last.
 */
export function signature(fields: Record<string, string>, passphrase = PASSPHRASE): string {
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
export function buildPaymentFields(p: PayfastPaymentInput): Record<string, string> {
  const fields: Record<string, string> = {
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
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
  fields.signature = signature(fields);
  return fields;
}

/** Verify the signature on an ITN (notify) payload. */
export function verifyItnSignature(data: Record<string, string>): boolean {
  const posted = data.signature ?? "";
  const calc = signature(data);
  return posted.length === calc.length &&
    crypto.timingSafeEqual(Buffer.from(posted), Buffer.from(calc));
}

/** Server-to-server confirmation that the ITN genuinely came from PayFast. */
export async function validateWithPayfast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch {
    return false;
  }
}

export function isConfigured(): boolean {
  return Boolean(MERCHANT_ID && MERCHANT_KEY);
}
