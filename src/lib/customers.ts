import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { libsql } from "./db";
import { hashPassword, verifyPassword } from "./admin-users";

// Client zone accounts. Separate from staff (admin_users): own table, own
// signed cookie. An account only sees orders placed with its (verified) email
// address, so the email must be confirmed before the first sign-in.

export interface CustomerAddress { street: string; suburb: string; city: string; province: string; postalCode: string }
export interface Customer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: CustomerAddress;
  verified: boolean;
  wishlistEmails: boolean;
  test: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

export const EMPTY_ADDRESS: CustomerAddress = { street: "", suburb: "", city: "", province: "", postalCode: "" };

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
export const CUSTOMER_COOKIE = "ttm_customer";
/** Readable flag so the browser knows to load the wishlist (holds no secret). */
export const CUSTOMER_FLAG = "ttm_cz";
export const CUSTOMER_MAXAGE = 60 * 60 * 24 * 30; // 30 days

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '{}',
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    wishlist_emails INTEGER NOT NULL DEFAULT 1,
    session_version INTEGER NOT NULL DEFAULT 1,
    test INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    last_login_at INTEGER
  )`);
  // The wishlist table too (same definition as lib/wishlist), so client lists
  // can count wishlist items before anyone has saved one.
  await libsql.execute(`CREATE TABLE IF NOT EXISTS wishlist (
    customer_id INTEGER NOT NULL,
    product_slug TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT 0,
    seen_price INTEGER NOT NULL DEFAULT 0,
    seen_on_sale INTEGER NOT NULL DEFAULT 0,
    seen_in_stock INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (customer_id, product_slug)
  )`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS customer_tokens (
    token_hash TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  )`);
  ensured = true;
}

type Row = Record<string, unknown>;
function parseAddress(raw: unknown): CustomerAddress {
  try { return { ...EMPTY_ADDRESS, ...(JSON.parse(String(raw || "{}")) as Partial<CustomerAddress>) }; } catch { return { ...EMPTY_ADDRESS }; }
}
function toCustomer(r: Row): Customer {
  return {
    id: Number(r.id),
    email: String(r.email),
    firstName: String(r.first_name ?? ""),
    lastName: String(r.last_name ?? ""),
    phone: String(r.phone ?? ""),
    address: parseAddress(r.address),
    verified: Number(r.verified) === 1,
    wishlistEmails: Number(r.wishlist_emails) === 1,
    test: Number(r.test) === 1,
    createdAt: Number(r.created_at) || 0,
    lastLoginAt: r.last_login_at == null ? null : Number(r.last_login_at),
  };
}

export const normEmail = (e: string) => e.trim().toLowerCase();

export async function getCustomerById(id: number): Promise<Customer | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM customers WHERE id = ?", args: [id] });
  return r.rows[0] ? toCustomer(r.rows[0] as Row) : null;
}

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM customers WHERE email = ?", args: [normEmail(email)] });
  return r.rows[0] ? toCustomer(r.rows[0] as Row) : null;
}

// ---- sessions ------------------------------------------------------------------
// Token: "<id>.<version>.<exp>.<mac>". Bumping session_version (password change
// / reset) signs out every other device.
function sign(id: number, ver: number, exp: number): string {
  return crypto.createHmac("sha256", SECRET).update(`customer.${id}.${ver}.${exp}`).digest("hex");
}

async function sessionVersion(id: number): Promise<number | null> {
  const r = await libsql.execute({ sql: "SELECT session_version FROM customers WHERE id = ?", args: [id] });
  return r.rows[0] ? Number(r.rows[0].session_version) || 1 : null;
}

export async function makeCustomerToken(id: number): Promise<string> {
  await ensureTables();
  const ver = (await sessionVersion(id)) ?? 1;
  const exp = Date.now() + CUSTOMER_MAXAGE * 1000;
  return `${id}.${ver}.${exp}.${sign(id, ver, exp)}`;
}

/** The signed-in client, or null. */
export async function getCustomer(): Promise<Customer | null> {
  const tok = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!tok) return null;
  const parts = tok.split(".");
  if (parts.length !== 4) return null;
  const [idS, verS, expS, mac] = parts;
  const id = Number(idS), ver = Number(verS), exp = Number(expS);
  if (!id || !ver || !exp || exp < Date.now() || !mac) return null;
  const expected = sign(id, ver, exp);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    await ensureTables();
    if ((await sessionVersion(id)) !== ver) return null;
    const c = await getCustomerById(id);
    return c && c.verified ? c : null;
  } catch {
    return null;
  }
}

// ---- register / sign in ----------------------------------------------------------
export interface RegisterInput { email: string; password: string; firstName: string; lastName: string; phone: string; wishlistEmails?: boolean; test?: boolean }

/** Create an unverified account. If the email already has an UNverified account,
 *  its details/password are replaced (someone may have mistyped the first time);
 *  a verified account is never touched. */
export async function registerCustomer(i: RegisterInput): Promise<{ ok: true; customer: Customer } | { ok: false; error: string; exists?: boolean }> {
  await ensureTables();
  const email = normEmail(i.email);
  const existing = await getCustomerByEmail(email);
  if (existing?.verified) return { ok: false, exists: true, error: "There's already an account for this email address. Sign in, or use “Forgot password”." };
  const now = Date.now();
  const args = [i.firstName.trim(), i.lastName.trim(), i.phone.trim(), hashPassword(i.password), i.wishlistEmails === false ? 0 : 1, i.test ? 1 : 0, now];
  if (existing) {
    await libsql.execute({ sql: "UPDATE customers SET first_name = ?, last_name = ?, phone = ?, password_hash = ?, wishlist_emails = ?, test = ?, updated_at = ? WHERE id = ?", args: [...args, existing.id] });
  } else {
    await libsql.execute({
      sql: "INSERT INTO customers (first_name, last_name, phone, password_hash, wishlist_emails, test, updated_at, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [...args, email, now],
    });
  }
  const c = await getCustomerByEmail(email);
  return c ? { ok: true, customer: c } : { ok: false, error: "Couldn't create the account." };
}

export async function checkCustomerLogin(email: string, password: string): Promise<{ ok: true; customer: Customer } | { ok: false; unverified?: boolean }> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM customers WHERE email = ?", args: [normEmail(email)] });
  const row = r.rows[0] as Row | undefined;
  // Always run a hash check so timing doesn't reveal which emails have accounts.
  const ok = verifyPassword(password, row ? String(row.password_hash) : "scrypt:00:00");
  if (!row || !ok) return { ok: false };
  const c = toCustomer(row);
  if (!c.verified) return { ok: false, unverified: true };
  await libsql.execute({ sql: "UPDATE customers SET last_login_at = ? WHERE id = ?", args: [Date.now(), c.id] });
  return { ok: true, customer: c };
}

// ---- one-time links (email confirmation, password reset) -------------------------
const hashTok = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createCustomerToken(customerId: number, kind: "verify" | "reset", ttlMs: number): Promise<string> {
  await ensureTables();
  const token = crypto.randomBytes(32).toString("base64url");
  // One live link per kind: older ones stop working.
  await libsql.execute({ sql: "DELETE FROM customer_tokens WHERE customer_id = ? AND kind = ?", args: [customerId, kind] });
  await libsql.execute({
    sql: "INSERT INTO customer_tokens (token_hash, customer_id, kind, expires_at) VALUES (?, ?, ?, ?)",
    args: [hashTok(token), customerId, kind, Date.now() + ttlMs],
  });
  return token;
}

async function consumeToken(token: string, kind: "verify" | "reset"): Promise<number | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT customer_id, expires_at, used_at FROM customer_tokens WHERE token_hash = ? AND kind = ?", args: [hashTok(token), kind] });
  const row = r.rows[0];
  if (!row || row.used_at != null || Number(row.expires_at) < Date.now()) return null;
  await libsql.execute({ sql: "UPDATE customer_tokens SET used_at = ? WHERE token_hash = ?", args: [Date.now(), hashTok(token)] });
  return Number(row.customer_id);
}

/** Confirm the email address. Returns the account (now verified) or null. */
export async function verifyCustomerEmail(token: string): Promise<Customer | null> {
  const id = await consumeToken(token, "verify");
  if (!id) return null;
  await libsql.execute({ sql: "UPDATE customers SET verified = 1, last_login_at = ?, updated_at = ? WHERE id = ?", args: [Date.now(), Date.now(), id] });
  return getCustomerById(id);
}

/** Set a new password from a reset link (also confirms the email, since the link
 *  proved they can read it) and sign out other devices. */
export async function resetCustomerPassword(token: string, password: string): Promise<Customer | null> {
  const id = await consumeToken(token, "reset");
  if (!id) return null;
  await libsql.execute({
    sql: "UPDATE customers SET password_hash = ?, verified = 1, session_version = session_version + 1, updated_at = ? WHERE id = ?",
    args: [hashPassword(password), Date.now(), id],
  });
  return getCustomerById(id);
}

// ---- profile -----------------------------------------------------------------------
export interface ProfilePatch { firstName?: string; lastName?: string; phone?: string; address?: CustomerAddress; wishlistEmails?: boolean }

export async function updateCustomerProfile(id: number, p: ProfilePatch): Promise<Customer | null> {
  await ensureTables();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (p.firstName !== undefined) { sets.push("first_name = ?"); args.push(p.firstName.trim()); }
  if (p.lastName !== undefined) { sets.push("last_name = ?"); args.push(p.lastName.trim()); }
  if (p.phone !== undefined) { sets.push("phone = ?"); args.push(p.phone.trim()); }
  if (p.address !== undefined) { sets.push("address = ?"); args.push(JSON.stringify(p.address)); }
  if (p.wishlistEmails !== undefined) { sets.push("wishlist_emails = ?"); args.push(p.wishlistEmails ? 1 : 0); }
  if (sets.length) {
    sets.push("updated_at = ?"); args.push(Date.now());
    await libsql.execute({ sql: `UPDATE customers SET ${sets.join(", ")} WHERE id = ?`, args: [...args, id] });
  }
  return getCustomerById(id);
}

/** Change password (current password required); signs out other devices. */
export async function changeCustomerPassword(id: number, current: string, next: string): Promise<boolean> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT password_hash FROM customers WHERE id = ?", args: [id] });
  if (!r.rows[0] || !verifyPassword(current, String(r.rows[0].password_hash))) return false;
  await libsql.execute({
    sql: "UPDATE customers SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?",
    args: [hashPassword(next), Date.now(), id],
  });
  return true;
}

/** Turn off wishlist emails from the unsubscribe link (signed, no sign-in needed). */
export function unsubscribeToken(id: number): string {
  return crypto.createHmac("sha256", SECRET).update(`unsub.${id}`).digest("hex").slice(0, 32);
}
export async function unsubscribeWishlist(id: number, tok: string): Promise<boolean> {
  const expected = unsubscribeToken(id);
  if (tok.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(expected))) return false;
  await updateCustomerProfile(id, { wishlistEmails: false });
  return true;
}

// ---- admin -----------------------------------------------------------------------------
export async function listCustomers(opts: { q?: string; limit?: number } = {}): Promise<(Customer & { orders: number; wishlist: number })[]> {
  try {
    await ensureTables();
    const q = opts.q?.trim().toLowerCase();
    const like = `%${q ?? ""}%`;
    const r = await libsql.execute({
      sql: `SELECT c.*,
              (SELECT COUNT(*) FROM orders o WHERE LOWER(json_extract(o.customer, '$.email')) = c.email) AS n_orders,
              (SELECT COUNT(*) FROM wishlist w WHERE w.customer_id = c.id) AS n_wish
            FROM customers c
            ${q ? "WHERE LOWER(c.email || ' ' || c.first_name || ' ' || c.last_name || ' ' || c.phone) LIKE ?" : ""}
            ORDER BY c.id DESC LIMIT ?`,
      args: q ? [like, opts.limit ?? 200] : [opts.limit ?? 200],
    });
    return r.rows.map((row) => ({ ...toCustomer(row as Row), orders: Number(row.n_orders) || 0, wishlist: Number(row.n_wish) || 0 }));
  } catch (e) {
    console.error("[customers] list failed:", (e as Error).message);
    return [];
  }
}
