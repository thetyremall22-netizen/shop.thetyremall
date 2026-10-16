import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { Order } from "./orders";
import { logEmail, type EmailType } from "./email-log";

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT ?? 587);
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const SECURE = (process.env.SMTP_SECURE ?? "false") === "true"; // true for 465, false for 587 STARTTLS
const FROM = process.env.MAIL_FROM ?? "The Tyre Mall <shop@thetyremall.co.za>";
export const SHOP_EMAIL = process.env.SHOP_EMAIL ?? "shop@thetyremall.co.za";

// Preferred on Vercel: Resend's HTTP API (no SMTP ports, no M365 basic-auth
// blocks). If RESEND_API_KEY is set we use it; otherwise we fall back to SMTP.
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export function emailConfigured(): boolean {
  return Boolean(RESEND_API_KEY || (HOST && USER && PASS));
}

// Testing: copy every outgoing email to these addresses so the look & feel can
// be reviewed. Set EMAIL_CC="" in Vercel env vars to turn this off once signed
// off. Any address that is already the primary recipient is skipped.
const CC_LIST = (process.env.EMAIL_CC ?? "tracy@iheartdigital.co.za, shop@thetyremall.co.za")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let transporter: Transporter | null = null;
function getTransport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

async function sendViaResend(to: string, subject: string, html: string, cc: string[]): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], ...(cc.length ? { cc } : {}), subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

export interface MailMeta {
  type?: EmailType;
  orderRef?: string | null;
  resend?: boolean;
  /** Always include the shop address in CC, even if EMAIL_CC is cleared. */
  ccShop?: boolean;
  /** Send with NO CC at all (e.g. password resets — never copy the shop). */
  noCc?: boolean;
}

export async function sendMail(to: string, subject: string, html: string, meta: MailMeta = {}): Promise<void> {
  const type = meta.type ?? "custom";
  const orderRef = meta.orderRef ?? null;
  const resend = meta.resend ?? false;

  if (!emailConfigured()) {
    console.warn(`[email] not configured (set RESEND_API_KEY or SMTP_*) — skipped "${subject}" to ${to}`);
    await logEmail({ toAddr: to, subject, html, type, orderRef, status: "skipped", provider: "none", resend });
    return;
  }
  const ccSet = new Set(meta.noCc ? [] : CC_LIST.map((a) => a));
  if (meta.ccShop && !meta.noCc) ccSet.add(SHOP_EMAIL);
  const cc = [...ccSet].filter((a) => a.toLowerCase() !== to.toLowerCase());
  const provider = RESEND_API_KEY ? "resend" : "smtp";
  try {
    if (RESEND_API_KEY) await sendViaResend(to, subject, html, cc);
    else await getTransport().sendMail({ from: FROM, to, subject, html, ...(cc.length ? { cc } : {}) });
    await logEmail({ toAddr: to, cc, subject, html, type, orderRef, status: "sent", provider, resend });
  } catch (e) {
    await logEmail({ toAddr: to, cc, subject, html, type, orderRef, status: "failed", provider, error: (e as Error).message, resend });
    throw e;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Admin-composed email to a customer — wraps a plain-text message in the
 *  branded template and always CCs the shop. */
export async function sendComposedEmail(
  to: string,
  subject: string,
  message: string,
  meta: { orderRef?: string | null } = {}
): Promise<void> {
  const body = `<div style="font-size:14px;line-height:1.6;color:${INK}">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`;
  await sendMail(to, subject, layout(subject, body), { type: "custom", ccShop: true, orderRef: meta.orderRef ?? null });
}

const SITE_URL = process.env.SITE_URL ?? "https://thetyremall.co.za";
// Abandoned-cart recovery keeps the "made by iHD" footer credit (as the WP plugin does).
const IHD_CREDIT = process.env.IHD_CREDIT_URL ?? "https://www.iheartdigital.co.za";

/** Abandoned-cart recovery email — nudges a shopper who left items behind. */
export async function sendAbandonedCartEmail(to: string, items: { name: string; qty: number; price: number }[], total: number): Promise<void> {
  const rows = items.map((i) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}</td>
     <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${zar(i.price * i.qty)}</td></tr>`
  ).join("");
  const body = `
    <p style="font-size:14px;margin:0 0 12px">You left some great tyres in your cart — they&apos;re still waiting for you. Free delivery on 2 or more tyres, nationwide.</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:12px 0">
      ${rows}
      <tr><td style="padding:10px 0 0;font-weight:800">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:800;color:${INK}">${zar(total)}</td></tr>
    </table>
    <p style="margin:18px 0"><a href="${SITE_URL}/cart" style="display:inline-block;background:${BRAND};color:${INK};font-weight:800;text-decoration:none;padding:12px 22px;border-radius:10px">Complete your order →</a></p>
    <p style="font-size:12px;color:#6b7280">Buy now, pay later with HappyPay &amp; Mobicred. Need help choosing? Just reply or WhatsApp us.</p>
    <p style="font-size:11px;color:#9aa2ab;margin-top:20px;border-top:1px solid #eee;padding-top:12px">
      Made by <a href="${IHD_CREDIT}" style="color:#9aa2ab">iHeart Digital</a>
    </p>`;
  await sendMail(to, "You left tyres in your cart — The Tyre Mall", layout("Still thinking it over?", body), { type: "abandoned_cart" });
}

/** Notify the shop of a WhatsApp / Tyrone product enquiry. */
export async function sendEnquiryEmail(e: {
  type: "whatsapp" | "tyrone";
  productName?: string; sku?: string; price?: number; productUrl?: string; message?: string;
}): Promise<void> {
  const rows: [string, string][] = [];
  if (e.productName) rows.push(["Product", e.productName]);
  if (e.sku) rows.push(["SKU", e.sku]);
  if (e.price != null) rows.push(["Price", `R${(e.price / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`]);
  if (e.productUrl) rows.push(["Link", `<a href="${e.productUrl}">${e.productUrl}</a>`]);
  if (e.message) rows.push(["Message", e.message]);
  const table = rows.map(([k, v]) => `<tr><td style="padding:4px 0;color:#6b7280">${k}</td><td style="padding:4px 0 4px 16px;font-weight:600">${v}</td></tr>`).join("");
  const label = e.type === "whatsapp" ? "WhatsApp product enquiry" : "Tyrone chat enquiry";
  await sendMail(
    SHOP_EMAIL,
    `${label}${e.productName ? ` — ${e.productName}` : ""}`,
    layout(label, `<p style="margin:0 0 12px;font-size:14px">A customer sent a ${label.toLowerCase()} from the website:</p>
      <table role="presentation" style="font-size:14px;border-collapse:collapse">${table}</table>`),
    { type: "enquiry" }
  );
}

// ---- formatting helpers -----------------------------------------------------
const zar = (minor: number) =>
  "R" + (minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BRAND = "#8ac53f";
const INK = "#14171a";

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0">
   <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <tr><td style="background:${INK};padding:20px 28px">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.5px">THE TYRE <span style="color:${BRAND}">MALL</span></span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px;color:${INK}">${title}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:#f4f5f7;padding:18px 28px;font-size:12px;color:#6b7280;text-align:center">
        The Tyre Mall · 31 Heronmere Road, Reuven, Johannesburg · 078 0088 788<br>
        <a href="https://shop-thetyremall.vercel.app" style="color:${BRAND}">shop.thetyremall.co.za</a>
      </td></tr>
    </table>
   </td></tr>
  </table></body></html>`;
}

function itemsTable(o: Order): string {
  const rows = o.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee">${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${zar(i.price * i.qty)}</td>
      </tr>`
    )
    .join("");
  const t = o.totals;
  const line = (label: string, val: string) =>
    `<tr><td style="padding:4px 0;color:#6b7280">${label}</td><td style="padding:4px 0;text-align:right">${val}</td></tr>`;
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:12px 0">
    ${rows}
    ${line("Subtotal", zar(t.subtotal))}
    ${t.setDiscount ? line("Set of 4 saving", `&minus;${zar(t.setDiscount)}`) : ""}
    ${t.alignmentTotal ? line("Wheel alignment", zar(t.alignmentTotal)) : ""}
    ${t.balanceTotal ? line("Balance &amp; valve", zar(t.balanceTotal)) : ""}
    ${t.hazardTotal ? line("Road hazard cover", zar(t.hazardTotal)) : ""}
    ${line("Delivery", t.delivery === 0 ? "FREE" : zar(t.delivery))}
    <tr><td style="padding:10px 0 0;font-weight:800;font-size:16px">Total</td>
        <td style="padding:10px 0 0;text-align:right;font-weight:800;font-size:16px;color:${INK}">${zar(t.total)}</td></tr>
  </table>`;
}

function deliveryBlock(o: Order): string {
  if (o.delivery.method === "fitment") {
    return `<p style="font-size:14px"><b>Fitment:</b> ${o.delivery.fitmentStore ?? "Partner centre"}${
      o.delivery.fitmentDate ? ` on ${o.delivery.fitmentDate}` : ""
    }<br><span style="color:#6b7280">We'll call to confirm your fitment slot.</span></p>`;
  }
  const a = o.delivery.address;
  return a
    ? `<p style="font-size:14px"><b>Deliver to:</b><br>${a.street}, ${a.suburb}<br>${a.city}, ${a.province} ${a.postalCode}</p>`
    : "";
}

function customerLine(o: Order): string {
  return `<p style="font-size:14px"><b>${o.customer.firstName} ${o.customer.lastName}</b><br>${o.customer.email} · ${o.customer.phone}</p>`;
}

// ---- templates --------------------------------------------------------------
type Tmpl = { subject: string; html: string };

function tProcessingCustomer(o: Order): Tmpl {
  return {
    subject: `Your Tyre Mall order ${o.reference} is confirmed`,
    html: layout(
      `Thanks ${o.customer.firstName} — your order is confirmed! 🎉`,
      `<p style="font-size:14px">We've received your payment and your order <b>${o.reference}</b> is now being processed.</p>
       ${itemsTable(o)}${deliveryBlock(o)}
       <p style="font-size:14px;color:#6b7280">We'll be in touch with delivery/fitment details shortly.</p>`
    ),
  };
}
function tNewOrderAdmin(o: Order): Tmpl {
  return {
    subject: `New order ${o.reference} — ${zar(o.totals.total)}`,
    html: layout(
      `New paid order ${o.reference}`,
      `${customerLine(o)}${itemsTable(o)}${deliveryBlock(o)}
       <p style="font-size:13px;color:#6b7280">Payment: ${o.paymentMethod}${o.pfPaymentId ? ` · PF ${o.pfPaymentId}` : ""}</p>`
    ),
  };
}
function tFailedCustomer(o: Order): Tmpl {
  return {
    subject: `Payment failed for order ${o.reference}`,
    html: layout(
      "Your payment didn't go through",
      `<p style="font-size:14px">We couldn't process payment for order <b>${o.reference}</b>. No charge was made.</p>
       <p style="font-size:14px">You can try again any time — your cart details are below.</p>${itemsTable(o)}`
    ),
  };
}
function tFailedAdmin(o: Order): Tmpl {
  return { subject: `Failed order ${o.reference}`, html: layout(`Failed order ${o.reference}`, `${customerLine(o)}${itemsTable(o)}`) };
}
function tCancelledCustomer(o: Order): Tmpl {
  return {
    subject: `Order ${o.reference} cancelled`,
    html: layout("Your order was cancelled", `<p style="font-size:14px">Order <b>${o.reference}</b> was cancelled and you were not charged.</p>${itemsTable(o)}`),
  };
}
function tCancelledAdmin(o: Order): Tmpl {
  return { subject: `Cancelled order ${o.reference}`, html: layout(`Cancelled order ${o.reference}`, `${customerLine(o)}${itemsTable(o)}`) };
}
function tRefundedCustomer(o: Order): Tmpl {
  return {
    subject: `Your order ${o.reference} has been refunded`,
    html: layout("Your refund is on its way", `<p style="font-size:14px">We've refunded order <b>${o.reference}</b> (${zar(o.totals.total)}).</p>${itemsTable(o)}`),
  };
}
function tCompletedCustomer(o: Order): Tmpl {
  return {
    subject: `Your order ${o.reference} is complete`,
    html: layout(`Your order is complete 🏁`, `<p style="font-size:14px">Order <b>${o.reference}</b> is all done. Thanks for shopping with The Tyre Mall!</p>${itemsTable(o)}`),
  };
}
function tOnHoldCustomer(o: Order): Tmpl {
  return {
    subject: `Order ${o.reference} is on hold`,
    html: layout("Your order is on hold", `<p style="font-size:14px">Order <b>${o.reference}</b> is on hold while we confirm a few details. We'll be in touch shortly.</p>${itemsTable(o)}`),
  };
}

// ---- high-level senders tied to order lifecycle -----------------------------
export async function sendOrderPaid(o: Order): Promise<void> {
  const cust = tProcessingCustomer(o);
  const admin = tNewOrderAdmin(o);
  await Promise.all([
    sendMail(o.customer.email, cust.subject, cust.html, { type: "order_paid", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, admin.subject, admin.html, { type: "order_new_admin", orderRef: o.reference }),
  ]);
}
export async function sendOrderFailed(o: Order): Promise<void> {
  const c = tFailedCustomer(o);
  const a = tFailedAdmin(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_failed", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, a.subject, a.html, { type: "order_failed_admin", orderRef: o.reference }),
  ]);
}
export async function sendOrderCancelled(o: Order): Promise<void> {
  const c = tCancelledCustomer(o);
  const a = tCancelledAdmin(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_cancelled", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, a.subject, a.html, { type: "order_cancelled_admin", orderRef: o.reference }),
  ]);
}
export async function sendOrderRefunded(o: Order): Promise<void> {
  const c = tRefundedCustomer(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_refunded", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, `[Order ${o.reference}] ${c.subject}`, c.html, { type: "order_refunded", orderRef: o.reference }),
  ]);
}
export async function sendOrderCompleted(o: Order): Promise<void> {
  const c = tCompletedCustomer(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_completed", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, `[Order ${o.reference}] ${c.subject}`, c.html, { type: "order_completed", orderRef: o.reference }),
  ]);
}
export async function sendOrderOnHold(o: Order): Promise<void> {
  const c = tOnHoldCustomer(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_on_hold", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, `[Order ${o.reference}] ${c.subject}`, c.html, { type: "order_on_hold", orderRef: o.reference }),
  ]);
}
