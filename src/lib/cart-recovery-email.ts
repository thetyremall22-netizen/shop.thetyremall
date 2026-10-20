import "server-only";
import { sendMail } from "./email";
import { getProduct } from "./catalogue";
import {
  prepareRun, recordEmailSent, getRecoverySettings,
  type RecoveryCart, type RecoverySettings,
} from "./cart-recovery";

// Cart Recovery emails + the scheduled run. Built by iHeart Digital.

const SITE_URL = (process.env.SITE_URL ?? "https://thetyremall.co.za").replace(/\/+$/, "");
const INK = "#14171a";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`);

export const recoveryUrl = (c: RecoveryCart) => `${SITE_URL}/cart/recover?t=${encodeURIComponent(c.token)}`;

function lastEnabledStep(s: RecoverySettings): number {
  let last = 1;
  s.emails.forEach((e, i) => { if (e.enabled) last = i + 1; });
  return last;
}

function tokens(text: string, c: RecoveryCart): string {
  return text
    .replace(/\{first_name\}/g, c.firstName || "there")
    .replace(/\{site_name\}/g, "The Tyre Mall")
    .replace(/\{total\}/g, zar(c.total));
}

/** Footer used on every recovery email. */
export function recoveryFooter(): string {
  return `<tr><td style="padding:24px 32px 28px;font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #f0f0f0">
      <p style="margin:0 0 6px"><a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a> · 078 0088 788</p>
      <p style="margin:0;font-size:11px;color:#b5b8c2">Powered by <a href="https://iheartdigital.co.za" style="color:#b5b8c2;text-decoration:underline">iHeart Digital</a></p>
    </td></tr>`;
}

function shell(brand: string, inner: string, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
  <tr><td align="center" style="background:${INK};padding:22px;border-bottom:4px solid ${esc(brand)}">
    <img src="${SITE_URL}/brand/logo.png" alt="The Tyre Mall" width="96" height="47" style="display:block;border:0;height:47px;width:auto">
  </td></tr>
  ${inner}
  ${recoveryFooter()}
</table></td></tr></table></body></html>`;
}

/** The recovery email for one step (1–3). */
export async function renderRecoveryEmail(c: RecoveryCart, step: number, s: RecoverySettings): Promise<{ subject: string; html: string }> {
  const brand = /^#[0-9a-f]{3,8}$/i.test(s.brandColor) ? s.brandColor : "#8ac53f";
  const e = s.emails[step - 1] ?? s.emails[0];
  const url = recoveryUrl(c);
  const items = await Promise.all(c.items.map(async (i) => {
    const p = await getProduct(i.slug).catch(() => undefined);
    return { ...i, image: i.image ?? p?.thumb ?? p?.image ?? null, url: abs(`/product/${i.slug}`) };
  }));
  const firstUrl = items[0]?.url ?? SITE_URL;

  const rows = items.map((i) => `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee;width:64px">${i.image ? `<img src="${esc(abs(i.image))}" alt="" width="56" style="border-radius:6px;display:block">` : ""}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;font-size:15px"><a href="${esc(i.url)}" style="color:#111827;text-decoration:none;font-weight:bold">${esc(i.name)}</a>
        <div style="color:#6b7280;font-size:13px">Qty: ${i.qty}</div></td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid #eee;font-size:15px;white-space:nowrap">${zar(i.price * i.qty)}</td>
    </tr>`).join("");

  const showDiscount = s.discount.enabled && s.discount.code && (!s.discount.finalOnly || step >= lastEnabledStep(s));
  const discount = showDiscount ? `<tr><td style="padding:20px 32px 0">
      <table role="presentation" width="100%" style="border:2px dashed ${esc(brand)};border-radius:8px"><tr><td align="center" style="padding:18px 20px">
        <div style="font-size:15px;color:#374151;margin-bottom:8px">${esc(s.discount.text.replace(/\{code\}/g, s.discount.code))}</div>
        <div style="display:inline-block;background:#f7fbef;border:1px solid ${esc(brand)};border-radius:6px;padding:8px 16px;font-size:20px;font-weight:bold;letter-spacing:2px;color:${INK}">${esc(s.discount.code)}</div>
        ${s.discount.autoApply ? `<div style="font-size:12px;color:#6b7280;margin-top:8px">Applied automatically when you use the button above.</div>` : ""}
      </td></tr></table></td></tr>` : "";

  const sp = s.support;
  const wa = sp.whatsapp ? `https://wa.me/${sp.whatsapp.replace(/\D/g, "")}${sp.whatsappMessage ? `?text=${encodeURIComponent(sp.whatsappMessage)}` : ""}` : "";
  const help = wa || sp.email || sp.phone ? `<tr><td style="padding:24px 32px 8px">
      <table role="presentation" width="100%" style="background:#f9fafb;border-radius:8px"><tr><td style="padding:16px 20px;font-size:14px;color:#374151">
        <strong style="display:block;margin-bottom:8px;color:#111827">Need a hand? Our team is here to help:</strong>
        ${wa ? `<div style="margin:4px 0">💬 <a href="${esc(wa)}" style="color:${INK}">Chat on WhatsApp</a></div>` : ""}
        ${sp.email ? `<div style="margin:4px 0">✉️ <a href="mailto:${esc(sp.email)}" style="color:${INK}">${esc(sp.email)}</a></div>` : ""}
        ${sp.phone ? `<div style="margin:4px 0">📞 <a href="tel:${esc(sp.phone.replace(/[^\d+]/g, ""))}" style="color:${INK}">${esc(sp.phone)}</a></div>` : ""}
      </td></tr></table></td></tr>` : "";

  const heading = tokens(s.heading, c);
  const inner = `
  <tr><td style="padding:32px 32px 8px"><h1 style="margin:0;font-size:24px;color:#111827">${esc(heading)}</h1></td></tr>
  <tr><td style="padding:8px 32px 0;font-size:16px;line-height:1.6;color:#374151">
    <p style="margin:0 0 8px">Hi ${esc(c.firstName || "there")},</p>
    <p style="margin:0">${esc(tokens(e.intro, c))}</p>
  </td></tr>
  ${rows ? `<tr><td style="padding:24px 32px 0"><table role="presentation" width="100%" style="border-collapse:collapse">${rows}
    <tr><td></td><td style="padding:10px 12px 0;font-weight:bold">Total</td><td align="right" style="padding:10px 0 0;font-weight:bold">${zar(c.total)}</td></tr></table></td></tr>` : ""}
  <tr><td align="center" style="padding:28px 32px 8px">
    <a href="${esc(url)}" style="display:inline-block;background:${esc(brand)};color:${INK};text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:8px">Complete my order</a>
  </td></tr>
  <tr><td align="center" style="padding:0 32px 8px"><a href="${esc(firstUrl)}" style="color:${INK};font-size:14px;text-decoration:underline">View the product again</a></td></tr>
  ${discount}
  ${help}`;
  return { subject: tokens(e.subject, c), html: shell(brand, inner, heading) };
}

/** A one-off message from the Carts page, in the same branded layout. */
export async function sendManualRecoveryEmail(c: RecoveryCart, subject: string, message: string): Promise<void> {
  const s = await getRecoverySettings();
  const brand = /^#[0-9a-f]{3,8}$/i.test(s.brandColor) ? s.brandColor : "#8ac53f";
  const body = esc(message).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#14171a">$1</a>');
  const inner = `<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6;color:#374151">${body}</td></tr>`;
  await sendMail(c.email, subject, shell(brand, inner, subject), { type: "abandoned_cart", orderRef: c.orderRef });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms))]);
}

/** Send one step now and record it. */
export async function sendRecoveryStep(c: RecoveryCart, step: number, s?: RecoverySettings): Promise<void> {
  const settings = s ?? (await getRecoverySettings());
  const { subject, html } = await renderRecoveryEmail(c, step, settings);
  await withTimeout(sendMail(c.email, subject, html, { type: "abandoned_cart", orderRef: c.orderRef }), 15_000);
  await recordEmailSent(c.id, step);
}

let running = false;
/** One scheduler pass: housekeeping, then send what's due (max 25 per run,
 *  15s per email, stop after 3 failures in a row so a slow mail server can
 *  never tie the site up). */
export async function runRecovery(): Promise<{ sent: number; due: number; failed: number }> {
  if (running) return { sent: 0, due: 0, failed: 0 };
  running = true;
  let sent = 0, failed = 0, streak = 0;
  try {
    const { settings, due } = await prepareRun();
    for (const d of due) {
      try {
        await sendRecoveryStep(d.cart, d.step, settings);
        sent++; streak = 0;
      } catch (e) {
        failed++; streak++;
        console.error(`[cart-recovery] email ${d.step} to cart #${d.cart.id} failed:`, (e as Error).message);
        if (streak >= 3) break;
      }
    }
    return { sent, due: due.length, failed };
  } catch (e) {
    console.error("[cart-recovery] run failed:", (e as Error).message);
    return { sent, due: 0, failed };
  } finally {
    running = false;
  }
}
