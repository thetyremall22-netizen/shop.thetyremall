import "server-only";
import crypto from "crypto";
import { libsql } from "./db";

// Cart Recovery — captures shoppers who don't finish checking out (and unpaid,
// failed or cancelled orders) and runs an automated 3-email recovery flow with
// a one-click "restore my cart" link. Built by iHeart Digital.
//
// Status flow:  abandoned / pending  →  contacted (email sent)  →  clicked (came
// back via the link or the exit popup)  →  recovered (bought after clicking).
// Carts that bought without engaging are "purchased" (not counted as a
// recovery); contacted carts with no sale after N days become "lost".

export type CartStatus = "abandoned" | "pending" | "contacted" | "clicked" | "recovered" | "purchased" | "lost";
export type CartSource = "checkout" | "pending_order" | "failed_order" | "cancelled_order";

export const STATUS_LABEL: Record<CartStatus, string> = {
  abandoned: "Abandoned", pending: "Unpaid", contacted: "Contacted", clicked: "Clicked (engaged)",
  recovered: "Recovered", purchased: "Bought (not via recovery)", lost: "Lost",
};
export const SOURCE_LABEL: Record<CartSource, string> = {
  checkout: "Abandoned at checkout", pending_order: "Unpaid order", failed_order: "Failed payment", cancelled_order: "Cancelled order",
};
const ACTIVE: CartStatus[] = ["abandoned", "pending", "contacted", "clicked"];

export interface RecoveryItem { slug: string; name: string; qty: number; price: number; image?: string | null; roadHazard?: boolean; alignment?: boolean; balanceQty?: number }
export interface Address { street?: string; suburb?: string; city?: string; province?: string; postalCode?: string }

export interface RecoveryCart {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: Address;
  items: RecoveryItem[];
  signature: string;
  total: number;
  source: CartSource;
  status: CartStatus;
  token: string;
  emailsSent: number;
  lastEmailAt: number | null;
  orderRef: string | null;
  recoveredOrderRef: string | null;
  recoveredValue: number;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

// ---- settings -----------------------------------------------------------------

export interface RecoverySettings {
  enabled: boolean;
  abandonMinutes: number;
  captureCheckout: boolean;
  capturePending: boolean;
  captureFailed: boolean;
  captureCancelled: boolean;
  markLostAfterDays: number;
  purgeAfterDays: number;
  emails: { enabled: boolean; delayMinutes: number; subject: string; intro: string }[];
  heading: string;
  brandColor: string;
  discount: { enabled: boolean; code: string; text: string; finalOnly: boolean; autoApply: boolean };
  support: { whatsapp: string; whatsappMessage: string; email: string; phone: string };
  exitPopup: { enabled: boolean; title: string; text: string; cta: string; ctaStay: string; cooldownHours: number };
}

export const DEFAULT_RECOVERY_SETTINGS: RecoverySettings = {
  enabled: true,
  abandonMinutes: 30,
  captureCheckout: true,
  capturePending: true,
  captureFailed: true,
  captureCancelled: false, // a cancel is often a deliberate decision
  markLostAfterDays: 7,
  purgeAfterDays: 0, // keep every record (0 = never delete)
  emails: [
    { enabled: true, delayMinutes: 0, subject: "Did you forget something at The Tyre Mall?", intro: "We noticed you left a few things in your cart. No worries — we saved them for you. Pick up right where you left off." },
    { enabled: true, delayMinutes: 1440, subject: "Your tyres are still waiting for you", intro: "Your order is still waiting! Stock can move fast, so complete your order before we sell out." },
    { enabled: true, delayMinutes: 4320, subject: "Last chance — need a hand with your order?", intro: "This is our last reminder about your cart. If anything is holding you back, our team is one click away and happy to help." },
  ],
  heading: "You left something behind!",
  brandColor: "#8ac53f",
  discount: { enabled: false, code: "", text: "Here’s a little something to help — use code {code} at checkout.", finalOnly: true, autoApply: true },
  support: { whatsapp: "27780088788", whatsappMessage: "Hi, I need help completing my order.", email: "shop@thetyremall.co.za", phone: "078 0088 788" },
  exitPopup: { enabled: false, title: "Wait — you left something behind!", text: "Complete your order before your tyres sell out.", cta: "Return to my cart", ctaStay: "Continue my order", cooldownHours: 24 },
};

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS cart_recovery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '{}',
    items TEXT NOT NULL DEFAULT '[]',
    signature TEXT NOT NULL DEFAULT '',
    total INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'checkout',
    status TEXT NOT NULL DEFAULT 'abandoned',
    token TEXT NOT NULL,
    emails_sent INTEGER NOT NULL DEFAULT 0,
    last_email_at INTEGER,
    order_ref TEXT,
    recovered_order_ref TEXT,
    recovered_value INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_activity_at INTEGER NOT NULL
  )`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS cart_recovery_email ON cart_recovery (email)`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS cart_recovery_status ON cart_recovery (status)`);
  await libsql.execute(`CREATE UNIQUE INDEX IF NOT EXISTS cart_recovery_token ON cart_recovery (token)`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS cart_recovery_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  // One-time import of carts captured by the old single-email version.
  try {
    const n = await libsql.execute("SELECT COUNT(*) c FROM cart_recovery");
    const migrated = await libsql.execute("SELECT value FROM cart_recovery_meta WHERE key = 'migrated_v1'");
    if (Number(n.rows[0].c) === 0 && !migrated.rows.length) {
      const old = await libsql.execute("SELECT * FROM abandoned_carts").catch(() => ({ rows: [] as Record<string, unknown>[] }));
      for (const r of old.rows as Record<string, unknown>[]) {
        const items = safeJson<RecoveryItem[]>(String(r.items ?? "[]"), []);
        const status: CartStatus = Number(r.recovered) ? "purchased" : r.emailed_at ? "contacted" : "abandoned";
        await libsql.execute({
          sql: `INSERT INTO cart_recovery (email, phone, items, signature, total, source, status, token, emails_sent, last_email_at, created_at, updated_at, last_activity_at)
                VALUES (?,?,?,?,?,'checkout',?,?,?,?,?,?,?)`,
          args: [String(r.email), String(r.phone ?? ""), JSON.stringify(items), signature(items), Number(r.total) || 0, status, newToken(),
            r.emailed_at ? 1 : 0, r.emailed_at ? Number(r.emailed_at) : null, Number(r.created_at) || Date.now(), Number(r.updated_at) || Date.now(), Number(r.updated_at) || Date.now()],
        });
      }
      await libsql.execute({ sql: "INSERT OR REPLACE INTO cart_recovery_meta (key, value) VALUES ('migrated_v1', ?)", args: [String(Date.now())] });
    }
  } catch (e) {
    console.error("[cart-recovery] migration skipped:", (e as Error).message);
  }
  ensured = true;
}

function safeJson<T>(s: string, d: T): T { try { return JSON.parse(s) as T; } catch { return d; } }
const newToken = () => crypto.randomBytes(24).toString("base64url");
function signature(items: RecoveryItem[]): string {
  return items.map((i) => `${i.slug}:${i.qty}`).sort().join("|");
}

function mergeSettings(stored: unknown): RecoverySettings {
  const D = DEFAULT_RECOVERY_SETTINGS;
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<RecoverySettings>;
  const emails = D.emails.map((d, i) => ({ ...d, ...(Array.isArray(s.emails) && s.emails[i] ? s.emails[i] : {}) }));
  return {
    ...D, ...s, emails,
    discount: { ...D.discount, ...(s.discount ?? {}) },
    support: { ...D.support, ...(s.support ?? {}) },
    exitPopup: { ...D.exitPopup, ...(s.exitPopup ?? {}) },
  };
}

export async function getRecoverySettings(): Promise<RecoverySettings> {
  try {
    await ensureTables();
    const r = await libsql.execute("SELECT value FROM cart_recovery_meta WHERE key = 'settings'");
    return mergeSettings(r.rows.length ? safeJson(String(r.rows[0].value), {}) : {});
  } catch {
    return DEFAULT_RECOVERY_SETTINGS;
  }
}

export async function saveRecoverySettings(s: RecoverySettings): Promise<void> {
  await ensureTables();
  await libsql.execute({ sql: "INSERT OR REPLACE INTO cart_recovery_meta (key, value) VALUES ('settings', ?)", args: [JSON.stringify(s)] });
}

// ---- rows -----------------------------------------------------------------------

function toCart(r: Record<string, unknown>): RecoveryCart {
  return {
    id: Number(r.id), email: String(r.email), firstName: String(r.first_name ?? ""), lastName: String(r.last_name ?? ""),
    phone: String(r.phone ?? ""), address: safeJson<Address>(String(r.address ?? "{}"), {}),
    items: safeJson<RecoveryItem[]>(String(r.items ?? "[]"), []), signature: String(r.signature ?? ""),
    total: Number(r.total) || 0, source: String(r.source) as CartSource, status: String(r.status) as CartStatus,
    token: String(r.token), emailsSent: Number(r.emails_sent) || 0, lastEmailAt: r.last_email_at == null ? null : Number(r.last_email_at),
    orderRef: r.order_ref == null ? null : String(r.order_ref), recoveredOrderRef: r.recovered_order_ref == null ? null : String(r.recovered_order_ref),
    recoveredValue: Number(r.recovered_value) || 0, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), lastActivityAt: Number(r.last_activity_at),
  };
}

export async function getCart(id: number): Promise<RecoveryCart | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM cart_recovery WHERE id = ?", args: [id] });
  return r.rows.length ? toCart(r.rows[0] as Record<string, unknown>) : null;
}

export async function getCartByToken(token: string): Promise<RecoveryCart | null> {
  if (!token || token.length < 20) return null;
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM cart_recovery WHERE token = ?", args: [token] });
  return r.rows.length ? toCart(r.rows[0] as Record<string, unknown>) : null;
}

export async function listCarts(opts: { status?: string; q?: string; limit?: number } = {}): Promise<RecoveryCart[]> {
  try {
    await ensureTables();
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (opts.status === "open") where.push(`status IN ('abandoned','pending','contacted','clicked')`);
    else if (opts.status) { where.push("status = ?"); args.push(opts.status); }
    const q = opts.q?.trim().toLowerCase();
    if (q) {
      const like = `%${q}%`;
      where.push(`(LOWER(email) LIKE ? OR LOWER(first_name || ' ' || last_name) LIKE ? OR phone LIKE ? OR LOWER(items) LIKE ? OR LOWER(IFNULL(order_ref,'')) LIKE ? OR LOWER(address) LIKE ?)`);
      args.push(like, like, `%${q.replace(/\D/g, "") || q}%`, like, like, like);
    }
    args.push(opts.limit ?? 500);
    // Most recent activity first, each customer's carts kept together.
    const r = await libsql.execute({
      sql: `SELECT c.* FROM cart_recovery c
            JOIN (SELECT email, MAX(updated_at) m FROM cart_recovery GROUP BY email) g ON g.email = c.email
            ${where.length ? "WHERE " + where.map((w) => w.replace(/\b(status|email|first_name|last_name|phone|items|order_ref|address)\b/g, "c.$1")).join(" AND ") : ""}
            ORDER BY g.m DESC, c.email, c.id DESC LIMIT ?`,
      args,
    });
    return (r.rows as Record<string, unknown>[]).map(toCart);
  } catch (e) {
    console.error("[cart-recovery] list failed:", (e as Error).message);
    return [];
  }
}

export async function recoveryStats(): Promise<{ tracked: number; open: number; contacted: number; clicked: number; recovered: number; recoveredValue: number; lost: number; purchased: number }> {
  try {
    await ensureTables();
    const r = await libsql.execute("SELECT status, COUNT(*) n FROM cart_recovery GROUP BY status");
    const by = new Map(r.rows.map((x) => [String(x.status), Number(x.n)]));
    // Recovered value counts each recovered ORDER once.
    const v = await libsql.execute("SELECT COUNT(*) n, COALESCE(SUM(v),0) s FROM (SELECT recovered_order_ref, MAX(recovered_value) v FROM cart_recovery WHERE status = 'recovered' GROUP BY COALESCE(recovered_order_ref, id))");
    const tracked = [...by.values()].reduce((a, b) => a + b, 0);
    return {
      tracked,
      open: ACTIVE.reduce((n, s) => n + (by.get(s) ?? 0), 0),
      contacted: by.get("contacted") ?? 0,
      clicked: by.get("clicked") ?? 0,
      recovered: Number(v.rows[0].n) || 0,
      recoveredValue: Number(v.rows[0].s) || 0,
      lost: by.get("lost") ?? 0,
      purchased: by.get("purchased") ?? 0,
    };
  } catch {
    return { tracked: 0, open: 0, contacted: 0, clicked: 0, recovered: 0, recoveredValue: 0, lost: 0, purchased: 0 };
  }
}

// ---- capture --------------------------------------------------------------------

/** Save/refresh a cart from the checkout form. The same cart (same products)
 *  updates one row; a different cart for the same customer starts a new one. */
export async function captureCheckout(c: {
  email: string; firstName?: string; lastName?: string; phone?: string; address?: Address; items: RecoveryItem[]; total: number;
}): Promise<void> {
  const settings = await getRecoverySettings();
  if (!settings.enabled || !settings.captureCheckout || !c.email || !c.items.length) return;
  await ensureTables();
  const now = Date.now();
  const sig = signature(c.items);
  const existing = await libsql.execute({
    sql: `SELECT * FROM cart_recovery WHERE LOWER(email) = LOWER(?) AND signature = ? AND status IN ('abandoned','pending','contacted','clicked') ORDER BY id DESC LIMIT 1`,
    args: [c.email, sig],
  });
  if (existing.rows.length) {
    const row = toCart(existing.rows[0] as Record<string, unknown>);
    await libsql.execute({
      sql: `UPDATE cart_recovery SET first_name = ?, last_name = ?, phone = ?, address = ?, items = ?, total = ?, updated_at = ?, last_activity_at = ? WHERE id = ?`,
      args: [c.firstName || row.firstName, c.lastName || row.lastName, c.phone || row.phone, JSON.stringify({ ...row.address, ...(c.address ?? {}) }),
        JSON.stringify(c.items), c.total, now, now, row.id],
    });
    return;
  }
  await libsql.execute({
    sql: `INSERT INTO cart_recovery (email, first_name, last_name, phone, address, items, signature, total, source, status, token, created_at, updated_at, last_activity_at)
          VALUES (?,?,?,?,?,?,?,?,'checkout','abandoned',?,?,?,?)`,
    args: [c.email.trim().toLowerCase(), c.firstName ?? "", c.lastName ?? "", c.phone ?? "", JSON.stringify(c.address ?? {}),
      JSON.stringify(c.items), sig, c.total, newToken(), now, now, now],
  });
}

/** Pick up unpaid / failed / cancelled orders (per settings) as recovery carts. */
async function syncOrders(s: RecoverySettings): Promise<void> {
  const want: string[] = [];
  if (s.capturePending) want.push("pending");
  if (s.captureFailed) want.push("failed");
  if (s.captureCancelled) want.push("cancelled");
  if (!want.length) return;
  const since = Date.now() - 14 * 86400_000;
  const r = await libsql.execute({
    sql: `SELECT o.* FROM orders o WHERE o.status IN (${want.map(() => "?").join(",")}) AND o.created_at > ? AND o.test = 0
          AND NOT EXISTS (SELECT 1 FROM cart_recovery c WHERE c.order_ref = o.reference)`,
    args: [...want, since],
  }).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const now = Date.now();
  for (const o of r.rows as Record<string, unknown>[]) {
    const status = String(o.status);
    // Unpaid orders get the same "abandon" grace period as checkouts.
    if (status === "pending" && now - Number(o.created_at) < s.abandonMinutes * 60_000) continue;
    const cust = safeJson<{ firstName?: string; lastName?: string; email?: string; phone?: string }>(String(o.customer), {});
    if (!cust.email) continue;
    // Skip if this customer has since paid for an order.
    const paid = await libsql.execute({
      sql: `SELECT 1 FROM orders WHERE status IN ('processing','completed') AND LOWER(json_extract(customer,'$.email')) = LOWER(?) AND created_at >= ? LIMIT 1`,
      args: [cust.email, Number(o.created_at)],
    });
    if (paid.rows.length) continue;
    const items = safeJson<RecoveryItem[]>(String(o.items), []).map((i) => ({ slug: i.slug, name: i.name, qty: i.qty, price: i.price, roadHazard: i.roadHazard, alignment: i.alignment, balanceQty: i.balanceQty }));
    const delivery = safeJson<{ address?: Address }>(String(o.delivery), {});
    const totals = safeJson<{ total?: number }>(String(o.totals), {});
    const source: CartSource = status === "pending" ? "pending_order" : status === "failed" ? "failed_order" : "cancelled_order";
    // An open checkout cart for the same products becomes this order's row.
    const sig = signature(items);
    const open = await libsql.execute({
      sql: `SELECT id FROM cart_recovery WHERE LOWER(email) = LOWER(?) AND signature = ? AND order_ref IS NULL AND status IN ('abandoned','contacted','clicked') ORDER BY id DESC LIMIT 1`,
      args: [cust.email, sig],
    });
    if (open.rows.length) {
      await libsql.execute({ sql: `UPDATE cart_recovery SET order_ref = ?, source = ?, updated_at = ? WHERE id = ?`, args: [String(o.reference), source, now, Number(open.rows[0].id)] });
      continue;
    }
    await libsql.execute({
      sql: `INSERT INTO cart_recovery (email, first_name, last_name, phone, address, items, signature, total, source, status, token, order_ref, created_at, updated_at, last_activity_at)
            VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?)`,
      args: [cust.email.toLowerCase(), cust.firstName ?? "", cust.lastName ?? "", cust.phone ?? "", JSON.stringify(delivery.address ?? {}),
        JSON.stringify(items), sig, Number(totals.total) || 0, source, newToken(), String(o.reference), now, now, Number(o.created_at)],
    });
  }
}

/** A customer paid for an order: credit a recovery only if they engaged
 *  (clicked the email link / exit popup); otherwise it's a normal purchase. */
export async function onOrderPaid(email: string, orderRef?: string, value?: number): Promise<void> {
  if (!email) return;
  try {
    await ensureTables();
    const r = await libsql.execute({
      sql: `SELECT * FROM cart_recovery WHERE LOWER(email) = LOWER(?) AND status IN ('abandoned','pending','contacted','clicked')`,
      args: [email],
    });
    const now = Date.now();
    for (const row of (r.rows as Record<string, unknown>[]).map(toCart)) {
      if (row.status === "clicked") {
        await libsql.execute({
          sql: `UPDATE cart_recovery SET status = 'recovered', recovered_order_ref = ?, recovered_value = ?, updated_at = ? WHERE id = ?`,
          args: [orderRef ?? null, value ?? row.total, now, row.id],
        });
      } else {
        await libsql.execute({ sql: `UPDATE cart_recovery SET status = 'purchased', recovered_order_ref = ?, updated_at = ? WHERE id = ?`, args: [orderRef ?? null, now, row.id] });
      }
    }
  } catch (e) {
    console.error("[cart-recovery] onOrderPaid failed:", (e as Error).message);
  }
}

/** Purchases the payment callbacks didn't report (e.g. paid by EFT and marked
 *  paid in Admin): match paid orders to open carts by email. */
async function detectPurchases(): Promise<void> {
  const r = await libsql.execute(`SELECT c.id, c.email, c.created_at FROM cart_recovery c WHERE c.status IN ('abandoned','pending','contacted','clicked')`);
  for (const row of r.rows as Record<string, unknown>[]) {
    const o = await libsql.execute({
      sql: `SELECT reference, json_extract(totals,'$.total') t FROM orders WHERE status IN ('processing','completed') AND LOWER(json_extract(customer,'$.email')) = LOWER(?) AND created_at >= ? ORDER BY id DESC LIMIT 1`,
      args: [String(row.email), Number(row.created_at)],
    });
    if (o.rows.length) await onOrderPaid(String(row.email), String(o.rows[0].reference), Number(o.rows[0].t) || undefined);
  }
}

/** The customer came back (recovery link or exit popup). */
export async function markClicked(id: number): Promise<void> {
  await ensureTables();
  await libsql.execute({
    sql: `UPDATE cart_recovery SET status = 'clicked', updated_at = ? WHERE id = ? AND status IN ('abandoned','pending','contacted','clicked','lost')`,
    args: [Date.now(), id],
  });
}

export async function markClickedByEmail(email: string): Promise<void> {
  if (!email) return;
  await ensureTables();
  await libsql.execute({
    sql: `UPDATE cart_recovery SET status = 'clicked', updated_at = ? WHERE LOWER(email) = LOWER(?) AND status IN ('abandoned','pending','contacted')`,
    args: [Date.now(), email],
  });
}

export async function setCartStatus(id: number, status: CartStatus): Promise<void> {
  await ensureTables();
  await libsql.execute({ sql: "UPDATE cart_recovery SET status = ?, updated_at = ? WHERE id = ?", args: [status, Date.now(), id] });
}

/** "Resend": restart the email flow (email 1 goes on the next run, immediately). */
export async function restartFlow(id: number): Promise<void> {
  await ensureTables();
  await libsql.execute({
    sql: `UPDATE cart_recovery SET emails_sent = 0, last_email_at = NULL, status = CASE WHEN status = 'clicked' THEN 'clicked' WHEN source = 'checkout' THEN 'abandoned' ELSE 'pending' END, last_activity_at = 0, updated_at = ? WHERE id = ?`,
    args: [Date.now(), id],
  });
}

export async function deleteCart(id: number): Promise<void> {
  await ensureTables();
  await libsql.execute({ sql: "DELETE FROM cart_recovery WHERE id = ?", args: [id] });
}

export async function recordEmailSent(id: number, step: number): Promise<void> {
  await libsql.execute({
    sql: `UPDATE cart_recovery SET emails_sent = ?, last_email_at = ?, status = CASE WHEN status = 'clicked' THEN 'clicked' ELSE 'contacted' END, updated_at = ? WHERE id = ?`,
    args: [step, Date.now(), Date.now(), id],
  });
}

// ---- the scheduler ------------------------------------------------------------------

export interface DueCart { cart: RecoveryCart; step: number }

/** Housekeeping + the list of carts whose next email is due now. */
export async function prepareRun(): Promise<{ settings: RecoverySettings; due: DueCart[] }> {
  const settings = await getRecoverySettings();
  await ensureTables();
  if (!settings.enabled) return { settings, due: [] };
  await syncOrders(settings);
  await detectPurchases();
  const now = Date.now();
  if (settings.markLostAfterDays > 0) {
    await libsql.execute({
      sql: `UPDATE cart_recovery SET status = 'lost', updated_at = ? WHERE status IN ('contacted','clicked') AND last_email_at IS NOT NULL AND last_email_at < ? AND emails_sent >= ?`,
      args: [now, now - settings.markLostAfterDays * 86400_000, settings.emails.filter((e) => e.enabled).length || 3],
    });
  }
  if (settings.purgeAfterDays > 0) {
    await libsql.execute({ sql: "DELETE FROM cart_recovery WHERE created_at < ? AND status NOT IN ('recovered')", args: [now - settings.purgeAfterDays * 86400_000] });
  }
  const r = await libsql.execute(`SELECT * FROM cart_recovery WHERE status IN ('abandoned','pending','contacted','clicked') AND email <> '' AND emails_sent < 3 ORDER BY updated_at ASC LIMIT 25`);
  const due: DueCart[] = [];
  for (const cart of (r.rows as Record<string, unknown>[]).map(toCart)) {
    // Next enabled step after the ones already sent.
    let step = cart.emailsSent + 1;
    while (step <= 3 && !settings.emails[step - 1]?.enabled) step++;
    if (step > 3) continue;
    const anchor = cart.lastEmailAt ?? cart.createdAt;
    if (now < anchor + settings.emails[step - 1].delayMinutes * 60_000) continue;
    // Never email someone who's still shopping: wait until they've been
    // inactive for the abandon window before the first email.
    if (cart.emailsSent === 0 && cart.lastActivityAt > 0 && now - cart.lastActivityAt < settings.abandonMinutes * 60_000) continue;
    due.push({ cart, step });
  }
  return { settings, due };
}
