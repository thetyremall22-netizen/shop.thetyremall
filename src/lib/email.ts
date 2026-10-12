import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { Order } from "./orders";

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT ?? 587);
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;
const SECURE = (process.env.SMTP_SECURE ?? "false") === "true"; // true for 465, false for 587 STARTTLS
const FROM = process.env.MAIL_FROM ?? "The Tyre Mall <shop@thetyremall.co.za>";
export const SHOP_EMAIL = process.env.SHOP_EMAIL ?? "shop@thetyremall.co.za";

export function emailConfigured(): boolean {
  return Boolean(HOST && USER && PASS);
}

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

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!emailConfigured()) {
    console.warn(`[email] SMTP not configured — skipped "${subject}" to ${to}`);
    return;
  }
  await getTransport().sendMail({ from: FROM, to, subject, html });
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
      <table role="presentation" style="font-size:14px;border-collapse:collapse">${table}</table>`)
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
    sendMail(o.customer.email, cust.subject, cust.html),
    sendMail(SHOP_EMAIL, admin.subject, admin.html),
  ]);
}
export async function sendOrderFailed(o: Order): Promise<void> {
  const c = tFailedCustomer(o);
  const a = tFailedAdmin(o);
  await Promise.all([sendMail(o.customer.email, c.subject, c.html), sendMail(SHOP_EMAIL, a.subject, a.html)]);
}
export async function sendOrderCancelled(o: Order): Promise<void> {
  const c = tCancelledCustomer(o);
  const a = tCancelledAdmin(o);
  await Promise.all([sendMail(o.customer.email, c.subject, c.html), sendMail(SHOP_EMAIL, a.subject, a.html)]);
}
export async function sendOrderRefunded(o: Order): Promise<void> {
  const c = tRefundedCustomer(o);
  await sendMail(o.customer.email, c.subject, c.html);
}
export async function sendOrderCompleted(o: Order): Promise<void> {
  const c = tCompletedCustomer(o);
  await sendMail(o.customer.email, c.subject, c.html);
}
export async function sendOrderOnHold(o: Order): Promise<void> {
  const c = tOnHoldCustomer(o);
  await sendMail(o.customer.email, c.subject, c.html);
}
