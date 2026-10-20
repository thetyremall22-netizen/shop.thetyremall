import "server-only";
import nodemailer from "nodemailer";
import type { Order } from "./orders";
import { logEmail, type EmailType } from "./email-log";
import { libsql } from "./db";
import type { SiteSettings } from "./settings";
import { getProduct } from "./catalogue";

export const SHOP_EMAIL = process.env.SHOP_EMAIL ?? "shop@thetyremall.co.za";

interface ResolvedEmail {
  resendKey: string; host: string; port: number; secure: boolean;
  user: string; pass: string; from: string; cc: string[];
}

/**
 * Resolve email config at CALL time: admin DB settings first, then env vars,
 * then sensible defaults.
 *
 * NOTE: on the self-hosted standalone build, BOTH this module's top-level
 * `process.env` reads AND Next's `"use cache"` getters (getSettings) are frozen
 * at build time. So we read the admin-saved email settings with a DIRECT,
 * uncached DB query here — that reflects live admin edits. (env is still read as
 * a fallback for Vercel, where it works at build + runtime.)
 */
async function emailConfig(): Promise<ResolvedEmail> {
  let e: Partial<SiteSettings["email"]> = {};
  try {
    const r = await libsql.execute({ sql: "SELECT value FROM settings WHERE key = 'email' LIMIT 1", args: [] });
    const raw = r.rows[0]?.value;
    if (raw) e = JSON.parse(String(raw)) as Partial<SiteSettings["email"]>;
  } catch { /* table/row missing — fall back to env */ }
  const pick = (dbv: string | undefined, env: string | undefined, def = "") =>
    (dbv && dbv.trim()) || (env && env.trim()) || def;
  return {
    resendKey: pick(e.resendApiKey, process.env.RESEND_API_KEY),
    host: pick(e.smtpHost, process.env.SMTP_HOST),
    port: Number((e.smtpPort ? String(e.smtpPort) : "") || process.env.SMTP_PORT || 587),
    secure: typeof e.smtpSecure === "boolean" ? e.smtpSecure : process.env.SMTP_SECURE === "true",
    user: pick(e.smtpUser, process.env.SMTP_USER),
    pass: pick(e.smtpPass, process.env.SMTP_PASS),
    from: pick(e.mailFrom, process.env.MAIL_FROM, "The Tyre Mall <shop@thetyremall.co.za>"),
    cc: pick(e.emailCc, process.env.EMAIL_CC, "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export async function emailConfigured(): Promise<boolean> {
  const c = await emailConfig();
  return Boolean(c.resendKey || (c.host && c.user && c.pass));
}

async function sendViaResend(cfg: ResolvedEmail, to: string, subject: string, html: string, cc: string[]): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to: [to], ...(cc.length ? { cc } : {}), subject, html }),
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

  const cfg = await emailConfig();
  const configured = Boolean(cfg.resendKey || (cfg.host && cfg.user && cfg.pass));
  if (!configured) {
    console.warn(`[email] not configured (set it in Admin → Settings → Email, or RESEND_API_KEY / SMTP_*) — skipped "${subject}" to ${to}`);
    await logEmail({ toAddr: to, subject, html, type, orderRef, status: "skipped", provider: "none", resend });
    return;
  }
  const ccSet = new Set(meta.noCc ? [] : cfg.cc);
  if (meta.ccShop && !meta.noCc) ccSet.add(SHOP_EMAIL);
  const cc = [...ccSet].filter((a) => a.toLowerCase() !== to.toLowerCase());
  const provider = cfg.resendKey ? "resend" : "smtp";
  try {
    if (cfg.resendKey) await sendViaResend(cfg, to, subject, html, cc);
    else {
      // When sending through the mail server on the SAME machine (localhost),
      // its TLS cert is issued for the server's real hostname, not "localhost",
      // so default cert validation would reject the STARTTLS handshake. Relaxing
      // it is safe here because the connection never leaves the box. External
      // hosts (Microsoft 365, Resend SMTP, etc.) stay fully validated.
      const isLocal = /^(localhost|127\.0\.0\.1|::1)$/i.test(cfg.host.trim());
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        ...(isLocal ? { tls: { rejectUnauthorized: false } } : {}),
      });
      await transporter.sendMail({ from: cfg.from, to, subject, html, ...(cc.length ? { cc } : {}) });
    }
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
    <p style="font-size:12px;color:#6b7280">Buy now, pay later with HappyPay. Need help choosing? Just reply or WhatsApp us.</p>
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

/** Source → human label for the shop notification + the admin Leads tab. */
const LEAD_SOURCE_LABEL: Record<string, string> = {
  "contact": "Contact form",
  "whatsapp-quote": "WhatsApp quote request",
  "whatsapp-enquiry": "WhatsApp product enquiry",
  "whatsapp-chat": "WhatsApp chat request",
  "tyrone": "Tyrone chat",
};

/** Unified "new lead" notification to the shop — used by EVERY website form
 *  (contact page, WhatsApp quote, WhatsApp product enquiry, Tyrone). Always
 *  includes all captured contact + product details so nothing has to be chased. */
export async function sendLeadEmail(l: {
  source: string; name?: string; email?: string; phone?: string;
  productName?: string; sku?: string; price?: number; productUrl?: string; message?: string;
  /** Admin → Leads id, for a direct "open this lead" link. */
  leadId?: number | null;
}): Promise<void> {
  const label = LEAD_SOURCE_LABEL[l.source] ?? l.source;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:5px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 0 5px 18px;font-weight:600;color:${INK}">${v}</td></tr>`;
  const rows: string[] = [];
  if (l.name) rows.push(row("Name", escapeHtml(l.name)));
  if (l.phone) rows.push(row("Phone", `<a href="tel:${escapeHtml(l.phone)}" style="color:${INK}">${escapeHtml(l.phone)}</a>`));
  if (l.email) rows.push(row("Email", `<a href="mailto:${escapeHtml(l.email)}" style="color:${INK}">${escapeHtml(l.email)}</a>`));
  if (l.productName) rows.push(row("Product", escapeHtml(l.productName)));
  if (l.sku) rows.push(row("SKU", escapeHtml(l.sku)));
  if (l.price != null) rows.push(row("Price", zar(l.price)));
  if (l.productUrl) rows.push(row("Link", `<a href="${escapeHtml(l.productUrl)}">${escapeHtml(l.productUrl)}</a>`));
  if (l.message) rows.push(row("Message", escapeHtml(l.message).replace(/\n/g, "<br>")));
  const who = l.name || l.phone || l.email || "website";
  const adminLink = l.leadId
    ? `<p style="margin:18px 0 0"><a href="${SITE_URL}/admin/leads/contact/${l.leadId}" style="display:inline-block;background:${BRAND};color:${INK};font-weight:800;text-decoration:none;padding:10px 18px;border-radius:10px">Open this lead in Admin →</a></p>`
    : "";
  const table = `<table role="presentation" style="font-size:14px;border-collapse:collapse">${rows.join("")}</table>`;
  const shop = sendMail(
    SHOP_EMAIL,
    `New lead — ${label} — ${who}`,
    layout(
      label,
      `<p style="margin:0 0 14px;font-size:14px">A customer submitted a <b>${label.toLowerCase()}</b> on the website. Please follow up so it doesn't drop off:</p>
       ${table}${adminLink}`
    ),
    { type: "enquiry" }
  );

  // A copy for the customer too, so they have a record of what they sent and
  // how to reach us (e.g. if WhatsApp drops).
  const customer = l.email
    ? sendMail(
        l.email,
        LEAD_CONFIRM_SUBJECT[l.source] ?? "We've received your enquiry — The Tyre Mall",
        layout(
          `Thanks${l.name ? ` ${escapeHtml(l.name.split(" ")[0])}` : ""} — we've got your details`,
          `<p style="margin:0 0 14px;font-size:14px">${LEAD_CONFIRM_INTRO[l.source] ?? "We've received your enquiry and a member of our team will be in touch shortly."}</p>
           <p style="margin:0 0 6px;font-size:13px;color:#6b7280">Here's a copy of what you sent us:</p>
           ${table}
           <p style="margin:18px 0 0;font-size:14px">Need us sooner? Call or WhatsApp <a href="tel:0780088788" style="color:${INK};font-weight:700">078 0088 788</a> (Mon–Fri 8:00–17:00, Sat 8:00–13:00) or reply to this email.</p>`
        ),
        { type: "lead_confirmation", noCc: true }
      )
    : Promise.resolve();

  // Only the shop copy is critical; a customer-copy failure is logged (Admin →
  // Emails) but doesn't fail the form.
  const [shopRes, custRes] = await Promise.allSettled([shop, customer]);
  if (custRes.status === "rejected") console.error("[lead] customer copy failed", custRes.reason);
  if (shopRes.status === "rejected") throw shopRes.reason;
}

const LEAD_CONFIRM_SUBJECT: Record<string, string> = {
  "contact": "We've received your message — The Tyre Mall",
  "whatsapp-quote": "We've received your quote request — The Tyre Mall",
  "whatsapp-enquiry": "Your tyre enquiry — The Tyre Mall",
  "whatsapp-chat": "Thanks for contacting The Tyre Mall",
  "tyrone": "Thanks for chatting with Tyrone — The Tyre Mall",
};
const LEAD_CONFIRM_INTRO: Record<string, string> = {
  "contact": "Thanks for contacting The Tyre Mall. We've received your message and will get back to you within one business day.",
  "whatsapp-quote": "Thanks for your quote request. Our team is putting your quote together and will contact you shortly.",
  "whatsapp-enquiry": "Thanks for your enquiry on WhatsApp. If the chat drops or we lose signal, we'll contact you on the details below.",
  "whatsapp-chat": "Thanks for reaching out on WhatsApp. If the chat drops or we lose signal, we'll contact you on the details below.",
  "tyrone": "Thanks for chatting with Tyrone, our tyre assistant. If you'd like a person to help, our team can contact you on the details below.",
};

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
      <tr><td style="background:${INK};padding:18px 28px">
        <img src="${SITE_URL}/brand/logo.png" alt="The Tyre Mall" width="96" height="47" style="display:block;border:0;outline:none;text-decoration:none;height:47px;width:auto" />
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px;color:${INK}">${title}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="background:#f4f5f7;padding:18px 28px;font-size:12px;color:#6b7280;text-align:center">
        The Tyre Mall · 31 Heronmere Road, Reuven, Johannesburg · 078 0088 788<br>
        <a href="https://thetyremall.co.za" style="color:${BRAND}">thetyremall.co.za</a>
      </td></tr>
    </table>
   </td></tr>
  </table></body></html>`;
}

function itemsTable(o: Order, showSku = false): string {
  const rows = o.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee">${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}${
          showSku ? `<br><span style="font-size:12px;color:#6b7280">Part no: <b style="color:${INK}">${i.sku ? escapeHtml(i.sku) : "—"}</b> · Qty ${i.qty}</span>` : ""
        }</td>
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
    ${t.couponDiscount ? line(`Coupon ${t.couponCode ?? ""}`, `&minus;${zar(t.couponDiscount)}`) : ""}
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

/** Everything the shop needs to action an order, at the top of every shop
 *  notification: customer details, delivery address / fitment, and payment. */
function shopDetails(o: Order): string {
  const c = o.customer;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`;
  const a = o.delivery.address;
  const where = o.delivery.method === "fitment"
    ? row("Fitment", `${escapeHtml(o.delivery.fitmentStore ?? "Partner centre")}${o.delivery.fitmentDate ? ` on ${escapeHtml(o.delivery.fitmentDate)}` : ""}`)
    : row("Delivery address", a
        ? [a.street, a.suburb, a.city, a.province, a.postalCode].filter(Boolean).map(escapeHtml).join("<br>")
        : "<i>No address captured</i>");
  return `<h3 style="margin:8px 0 4px;font-size:15px">Customer details</h3>
    <table role="presentation" style="border-collapse:collapse;font-size:14px">
      ${row("Name", `<b>${escapeHtml(`${c.firstName} ${c.lastName}`.trim())}</b>`)}
      ${row("Email", `<a href="mailto:${escapeHtml(c.email)}" style="color:${INK}">${escapeHtml(c.email)}</a>`)}
      ${row("Phone", c.phone ? `<a href="tel:${escapeHtml(c.phone.replace(/\s+/g, ""))}" style="color:${INK}">${escapeHtml(c.phone)}</a>` : "—")}
      ${row("Order", `<b>${escapeHtml(o.reference)}</b> · ${escapeHtml(o.status)}`)}
      ${where}
      ${row("Payment", `${escapeHtml(o.paymentMethod)}${o.pfPaymentId ? ` · PF ${escapeHtml(o.pfPaymentId)}` : ""}`)}
    </table>
    <h3 style="margin:18px 0 0;font-size:15px">Items</h3>`;
}

/** Fill in part numbers for orders placed before SKUs were saved on the order. */
async function withSkus(o: Order): Promise<Order> {
  if (o.items.every((i) => i.sku)) return o;
  const items = await Promise.all(o.items.map(async (i) => {
    if (i.sku) return i;
    try { return { ...i, sku: (await getProduct(i.slug))?.sku || undefined }; } catch { return i; }
  }));
  return { ...o, items };
}

/** The shop's copy of any order email. */
function shopOrder(o: Order, title: string): string {
  return layout(title, `${shopDetails(o)}${itemsTable(o, true)}`);
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
    html: shopOrder(o, `New paid order ${o.reference}`),
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
  return { subject: `Failed order ${o.reference}`, html: shopOrder(o, `Failed order ${o.reference}`) };
}
function tCancelledCustomer(o: Order): Tmpl {
  return {
    subject: `Order ${o.reference} cancelled`,
    html: layout("Your order was cancelled", `<p style="font-size:14px">Order <b>${o.reference}</b> was cancelled and you were not charged.</p>${itemsTable(o)}`),
  };
}
function tCancelledAdmin(o: Order): Tmpl {
  return { subject: `Cancelled order ${o.reference}`, html: shopOrder(o, `Cancelled order ${o.reference}`) };
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
export async function sendOrderPaid(order: Order): Promise<void> {
  const o = await withSkus(order);
  const cust = tProcessingCustomer(o);
  const admin = tNewOrderAdmin(o);
  await Promise.all([
    sendMail(o.customer.email, cust.subject, cust.html, { type: "order_paid", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, admin.subject, admin.html, { type: "order_new_admin", orderRef: o.reference }),
  ]);
}
export async function sendOrderFailed(order: Order): Promise<void> {
  const o = await withSkus(order);
  const c = tFailedCustomer(o);
  const a = tFailedAdmin(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_failed", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, a.subject, a.html, { type: "order_failed_admin", orderRef: o.reference }),
  ]);
}
export async function sendOrderCancelled(order: Order): Promise<void> {
  const o = await withSkus(order);
  const c = tCancelledCustomer(o);
  const a = tCancelledAdmin(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_cancelled", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, a.subject, a.html, { type: "order_cancelled_admin", orderRef: o.reference }),
  ]);
}
export async function sendOrderRefunded(order: Order): Promise<void> {
  const o = await withSkus(order);
  const c = tRefundedCustomer(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_refunded", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, `[Order ${o.reference}] ${c.subject}`, shopOrder(o, `Order ${o.reference} refunded`), { type: "order_refunded", orderRef: o.reference }),
  ]);
}
export async function sendOrderCompleted(order: Order): Promise<void> {
  const o = await withSkus(order);
  const c = tCompletedCustomer(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_completed", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, `[Order ${o.reference}] ${c.subject}`, shopOrder(o, `Order ${o.reference} completed`), { type: "order_completed", orderRef: o.reference }),
  ]);
}
export async function sendOrderOnHold(order: Order): Promise<void> {
  const o = await withSkus(order);
  const c = tOnHoldCustomer(o);
  await Promise.all([
    sendMail(o.customer.email, c.subject, c.html, { type: "order_on_hold", orderRef: o.reference }),
    sendMail(SHOP_EMAIL, `[Order ${o.reference}] ${c.subject}`, shopOrder(o, `Order ${o.reference} on hold`), { type: "order_on_hold", orderRef: o.reference }),
  ]);
}
