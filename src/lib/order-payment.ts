import "server-only";
import { getOrder, updateOrder, STATUS_LABEL, type Order } from "./orders";
import { libsql } from "./db";
import { decrementStock } from "./db/queries";
import { sendOrderPaid, sendOrderFailed, sendMail, SHOP_EMAIL } from "./email";
import { recordRedemption } from "./coupons";
import { markRecovered } from "./abandoned";
import { addAudit } from "./audit";
import { fetchHappyPayStatus } from "./happypay";

// One place that turns a paid order into "Processing" — used by PayFast,
// HappyPay, 100%-off coupon orders and the background payment re-check — so
// every paid order gets the same treatment: stock taken off, the client's
// confirmation email AND the shop's "new order" email, coupon use recorded.

/** Mark an order paid. Safe to call more than once (only the first call acts). */
export async function completePaidOrder(orderId: string, opts: { paymentMethod?: string; pfPaymentId?: string; actor: string; note: string }): Promise<Order | null> {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (order.status === "processing" || order.status === "completed") return order; // already done
  // Claim it atomically: if a gateway callback and the background re-check
  // arrive together, only one of them sends the emails / takes the stock off.
  const claim = await libsql.execute({
    sql: "UPDATE orders SET status = 'processing', updated_at = ? WHERE order_id = ? AND status NOT IN ('processing', 'completed')",
    args: [Date.now(), orderId],
  });
  if (!claim.rowsAffected) return getOrder(orderId);
  await addAudit({
    entity: "order", entityId: orderId, action: "status", actor: opts.actor,
    summary: `Status: ${STATUS_LABEL[order.status] ?? order.status} → ${STATUS_LABEL.processing} — ${opts.note}`,
    before: { status: order.status }, after: { status: "processing" },
  }).catch(() => {});
  const updated = await updateOrder(orderId, {
    status: "processing",
    ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
    ...(opts.pfPaymentId ? { pfPaymentId: opts.pfPaymentId } : {}),
  });
  if (!updated) return null;
  for (const it of updated.items) await decrementStock(it.slug, it.qty).catch((e) => console.error("[payment] stock update failed:", (e as Error).message));
  try {
    await sendOrderPaid(updated);
  } catch (e) {
    console.error(`[payment] order emails failed for ${updated.reference}:`, (e as Error).message);
    await addAudit({ entity: "order", entityId: orderId, action: "email", actor: "System", summary: "⚠ Order confirmation emails FAILED to send — check Admin → Emails and resend" }).catch(() => {});
  }
  if (updated.totals.couponCode && updated.totals.couponDiscount > 0) {
    await recordRedemption(updated.totals.couponCode, updated.reference, updated.customer.email, updated.totals.couponDiscount).catch(() => {});
  }
  await markRecovered(updated.customer.email, updated.reference, updated.totals.total).catch(() => {});
  return updated;
}

/** Payment declined/failed: mark failed and tell the client and the shop. */
export async function failOrder(orderId: string, opts: { actor: string; note: string; pfPaymentId?: string }): Promise<void> {
  const order = await getOrder(orderId);
  if (!order || !["pending", "on-hold"].includes(order.status)) return;
  const updated = await updateOrder(orderId, { status: "failed", ...(opts.pfPaymentId ? { pfPaymentId: opts.pfPaymentId } : {}) }, { actor: opts.actor, note: opts.note });
  if (updated) await sendOrderFailed(updated).catch((e) => console.error("[payment] failed-order email:", (e as Error).message));
}

/** Something about the payment needs a person to look at it: put the order on
 *  hold AND email the shop, so it's never missed. */
export async function holdForReview(orderId: string, opts: { actor: string; reason: string; pfPaymentId?: string }): Promise<void> {
  const order = await getOrder(orderId);
  if (!order || order.status === "processing" || order.status === "completed") return;
  await updateOrder(orderId, { status: "on-hold", ...(opts.pfPaymentId ? { pfPaymentId: opts.pfPaymentId } : {}) }, { actor: opts.actor, note: opts.reason });
  const site = process.env.SITE_URL ?? "https://thetyremall.co.za";
  await sendMail(
    SHOP_EMAIL,
    `⚠ Check payment for order ${order.reference} — on hold`,
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#14171a">
      <p><b>Order ${order.reference}</b> (${order.customer.firstName} ${order.customer.lastName}, ${order.customer.email}, R${(order.totals.total / 100).toFixed(2)}) has been put <b>on hold</b> because:</p>
      <p style="background:#fff7e6;border-left:3px solid #f59e0b;padding:10px 12px">${opts.reason.replace(/</g, "&lt;")}</p>
      <p>Please check the payment with the payment provider, then set the order to Processing (or Failed) in the admin.</p>
      <p><a href="${site}/admin/orders/${encodeURIComponent(orderId)}">Open order ${order.reference} in the admin →</a></p>
    </div>`,
    { type: "order_on_hold", orderRef: order.reference, noCc: true },
  ).catch((e) => console.error("[payment] hold alert email failed:", (e as Error).message));
}

// ---- HappyPay status wording -----------------------------------------------------
// HappyPay's status text isn't one fixed word, so match on meaning. Approved /
// accepted / paid etc. = paid; declined / cancelled / expired etc. = not paid.
const HP_PAID = /complete|paid|success|approv|accept|active|fund|settl|captur|authori[sz]|confirm|disburs/i;
const HP_NOT_PAID = /declin|reject|fail|cancel|expir|abandon|void|refund|revers|denied|unpaid|not[ _-]?paid|non[ _-]?payment|inactive|unsuccess|unapprov|not[ _-]?approv|not[ _-]?accept/i;

export function classifyHappyPayStatus(status: string | null | undefined): "paid" | "not_paid" | "unknown" {
  if (!status) return "unknown";
  if (HP_NOT_PAID.test(status)) return "not_paid";
  if (HP_PAID.test(status)) return "paid";
  return "unknown";
}

// ---- HappyPay re-check (safety net if HappyPay's callback never arrives) --------

/** Ask HappyPay about one order and finish it if HappyPay says it's paid/approved. */
export async function recheckHappyPayOrder(orderId: string, actor = "HappyPay (status check)"): Promise<"paid" | "not_paid" | "unknown" | "skipped"> {
  const order = await getOrder(orderId);
  if (!order || order.paymentMethod !== "happypay") return "skipped";
  if (!["pending", "on-hold"].includes(order.status) && !(order.status === "cancelled" && (await wasAutoCancelled(orderId)))) return "skipped";
  const hp = await fetchHappyPayStatus(orderId);
  const verdict = classifyHappyPayStatus(hp?.status);
  if (verdict === "paid") {
    await completePaidOrder(orderId, { paymentMethod: "happypay", actor, note: `HappyPay status: ${hp?.status}` });
  }
  return verdict;
}

/** Every waiting HappyPay order from the last 3 days — but only ones placed
 *  after this check was first switched on, so older orders are never changed
 *  automatically. */
export async function recheckHappyPayOrders(): Promise<{ checked: number; paid: number }> {
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  await libsql.execute({ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('hp_recheck_since', ?)", args: [String(Date.now())] });
  const since = Number((await libsql.execute("SELECT value FROM meta WHERE key = 'hp_recheck_since'")).rows[0]?.value) || Date.now();
  const r = await libsql.execute({
    sql: `SELECT order_id FROM orders WHERE payment_method = 'happypay'
          AND (status IN ('pending', 'on-hold') OR (status = 'cancelled' AND order_id IN (SELECT substr(key, 16) FROM meta WHERE key LIKE 'auto_cancelled:%')))
          AND created_at >= ? AND created_at >= ? ORDER BY id LIMIT 50`,
    args: [since, Date.now() - 3 * 86400_000],
  });
  let paid = 0;
  for (const row of r.rows) if ((await recheckHappyPayOrder(String(row.order_id))) === "paid") paid++;
  return { checked: r.rows.length, paid };
}

// ---- PayFast safety net ---------------------------------------------------------
// PayFast only returns a customer to the "thank you" page after a successful
// payment. If PayFast's own confirmation (ITN) hasn't arrived 10 minutes later,
// put the order on hold and email the shop, so a paid order is never missed.

export async function notePayfastReturn(orderId: string): Promise<void> {
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  await libsql.execute({ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)", args: [`pf_returned:${orderId}`, String(Date.now())] });
  await addAudit({ entity: "order", entityId: orderId, action: "note", actor: "Customer (website)", summary: "Came back from PayFast to the thank-you page (PayFast only does this after a successful payment) — waiting for PayFast's confirmation" }).catch(() => {});
}

export async function watchPayfastReturns(): Promise<number> {
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  const r = await libsql.execute({
    sql: "SELECT key, value FROM meta WHERE key LIKE 'pf_returned:%' AND CAST(value AS INTEGER) < ?",
    args: [Date.now() - 10 * 60_000],
  });
  let alerted = 0;
  for (const row of r.rows) {
    const orderId = String(row.key).slice("pf_returned:".length);
    const order = await getOrder(orderId);
    if (order && order.status === "pending") {
      await holdForReview(orderId, {
        actor: "System (PayFast check)",
        reason: "The customer came back from PayFast to the thank-you page (PayFast only does this after a successful payment), but PayFast's payment confirmation hasn't reached the website after 10 minutes. Please check this payment in your PayFast account — if it's paid, set the order to Processing.",
      });
      alerted++;
    }
    await libsql.execute({ sql: "DELETE FROM meta WHERE key = ?", args: [String(row.key)] });
  }
  return alerted;
}

// ---- Unpaid orders: cancelled automatically -----------------------------------
// Like the old site's "hold stock" timer: an order still waiting for payment is
// cancelled after 1 hour (PayFast) or 24 hours (HappyPay — approvals can take a
// while). Stock is only ever taken off once an order is paid, so there's nothing
// to put back. No email goes to the customer; the order history gets a note.
// Only orders placed after this was switched on are touched. Orders "On hold"
// (waiting for someone to check a payment) are never cancelled automatically.
// If the payment does arrive later, the order still goes to Processing as normal.

const UNPAID_LIMIT_MIN: Record<string, number> = { payfast: 60, happypay: 24 * 60 };

async function wasAutoCancelled(orderId: string): Promise<boolean> {
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  const r = await libsql.execute({ sql: "SELECT 1 FROM meta WHERE key = ?", args: [`auto_cancelled:${orderId}`] });
  return r.rows.length > 0;
}

export async function cancelUnpaidOrders(): Promise<number> {
  await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  await libsql.execute({ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('auto_cancel_since', ?)", args: [String(Date.now())] });
  const since = Number((await libsql.execute("SELECT value FROM meta WHERE key = 'auto_cancel_since'")).rows[0]?.value) || Date.now();
  const r = await libsql.execute({
    sql: "SELECT order_id, payment_method, created_at FROM orders WHERE status = 'pending' AND created_at >= ? ORDER BY id LIMIT 200",
    args: [since],
  });
  let cancelled = 0;
  for (const row of r.rows) {
    const orderId = String(row.order_id);
    const method = String(row.payment_method ?? "");
    const limit = UNPAID_LIMIT_MIN[method] ?? 60;
    if (Date.now() - Number(row.created_at) < limit * 60_000) continue;
    // HappyPay: one last check first, in case it was approved and the notice was missed.
    if (method === "happypay" && (await recheckHappyPayOrder(orderId, "HappyPay (final check before cancelling)")) === "paid") continue;
    const order = await getOrder(orderId);
    if (!order || order.status !== "pending") continue;
    const hours = limit >= 60 ? `${limit / 60} hour${limit === 60 ? "" : "s"}` : `${limit} minutes`;
    await updateOrder(orderId, { status: "cancelled" }, {
      actor: "System (unpaid order timer)",
      note: `Cancelled automatically — not paid within ${hours} of being placed${method ? ` (${method === "payfast" ? "PayFast" : method === "happypay" ? "HappyPay" : method})` : ""}. If the payment still comes through, the order will move to Processing automatically.`,
    });
    await libsql.execute({ sql: "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", args: [`auto_cancelled:${orderId}`, String(Date.now())] });
    cancelled++;
  }
  return cancelled;
}
