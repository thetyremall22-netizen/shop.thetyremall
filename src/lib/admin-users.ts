import "server-only";
import crypto from "crypto";
import { libsql } from "./db";

export type Role = "super_admin" | "manager" | "editor" | "viewer";
export const ROLES: Role[] = ["super_admin", "manager", "editor", "viewer"];
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  editor: "Editor",
  viewer: "Viewer (read-only)",
};

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: number | null;
  createdAt: number;
}

// ---- password hashing (scrypt; no native deps, serverless-safe) -------------
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = (stored || "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const hash = crypto.scryptSync(pw, Buffer.from(parts[1], "hex"), 64);
    const expected = Buffer.from(parts[2], "hex");
    return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

// ---- table ------------------------------------------------------------------
let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    active INTEGER NOT NULL DEFAULT 1,
    totp_secret TEXT,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    last_login_at INTEGER
  )`);
  ensured = true;
}

type Row = Record<string, unknown>;
function toUser(r: Row): AdminUser {
  return {
    id: Number(r.id),
    email: String(r.email),
    name: String(r.name ?? ""),
    role: (String(r.role) as Role) || "viewer",
    active: Number(r.active) === 1,
    lastLoginAt: r.last_login_at == null ? null : Number(r.last_login_at),
    createdAt: Number(r.created_at) || 0,
  };
}

const norm = (e: string) => e.trim().toLowerCase();

export async function countUsers(): Promise<number> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT COUNT(*) c FROM admin_users");
    return Number(r.rows[0].c) || 0;
  } catch { return 0; }
}

export async function listUsers(): Promise<AdminUser[]> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT * FROM admin_users ORDER BY role, email");
    return (r.rows as unknown as Row[]).map(toUser);
  } catch (e) {
    console.error("[admin-users] list failed:", (e as Error).message);
    return [];
  }
}

export async function getUserById(id: number): Promise<AdminUser | null> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM admin_users WHERE id = ? LIMIT 1", args: [id] });
    return r.rows.length ? toUser(r.rows[0] as unknown as Row) : null;
  } catch { return null; }
}

/** For login: returns the user row incl. password hash, or null. */
export async function getUserForAuth(email: string): Promise<(AdminUser & { passwordHash: string }) | null> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM admin_users WHERE email = ? LIMIT 1", args: [norm(email)] });
    if (!r.rows.length) return null;
    const row = r.rows[0] as unknown as Row;
    return { ...toUser(row), passwordHash: String(row.password_hash) };
  } catch { return null; }
}

export async function createUser(input: { email: string; name: string; role: Role; password: string }): Promise<{ ok: boolean; error?: string; id?: number }> {
  await ensureTable();
  const email = norm(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if ((input.password || "").length < 10) return { ok: false, error: "Password must be at least 10 characters." };
  if (!ROLES.includes(input.role)) return { ok: false, error: "Invalid role." };
  const existing = await getUserForAuth(email);
  if (existing) return { ok: false, error: "A user with that email already exists." };
  const now = Date.now();
  const res = await libsql.execute({
    sql: `INSERT INTO admin_users (email, name, password_hash, role, active, created_at, updated_at) VALUES (?,?,?,?,1,?,?)`,
    args: [email, input.name.trim().slice(0, 120), hashPassword(input.password), input.role, now, now],
  });
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function updateUser(id: number, patch: { name?: string; role?: Role; active?: boolean; password?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureTable();
  const sets: string[] = ["updated_at = ?"];
  const args: (string | number)[] = [Date.now()];
  if (patch.name !== undefined) { sets.push("name = ?"); args.push(patch.name.trim().slice(0, 120)); }
  if (patch.role !== undefined) { if (!ROLES.includes(patch.role)) return { ok: false, error: "Invalid role." }; sets.push("role = ?"); args.push(patch.role); }
  if (patch.active !== undefined) { sets.push("active = ?"); args.push(patch.active ? 1 : 0); }
  if (patch.password !== undefined) { if (patch.password.length < 10) return { ok: false, error: "Password must be at least 10 characters." }; sets.push("password_hash = ?"); args.push(hashPassword(patch.password)); }
  if (sets.length === 1) return { ok: true };
  args.push(id);
  await libsql.execute({ sql: `UPDATE admin_users SET ${sets.join(", ")} WHERE id = ?`, args });
  return { ok: true };
}

export async function recordLogin(id: number): Promise<void> {
  try {
    await ensureTable();
    await libsql.execute({ sql: "UPDATE admin_users SET last_login_at = ? WHERE id = ?", args: [Date.now(), id] });
  } catch { /* non-fatal */ }
}

// ---- password resets --------------------------------------------------------
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

let resetEnsured = false;
async function ensureResetTable() {
  if (resetEnsured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`);
  resetEnsured = true;
}

/** Create a reset token for an email. Returns the raw token (emailed), or null
 *  if there's no active account (callers must not reveal which). */
export async function createResetToken(email: string): Promise<{ token: string; user: AdminUser } | null> {
  try {
    await ensureResetTable();
    const user = await getUserForAuth(email);
    if (!user || !user.active) return null;
    const token = crypto.randomBytes(32).toString("hex");
    await libsql.execute({
      sql: "INSERT INTO password_resets (user_id, token_hash, expires_at, used) VALUES (?,?,?,0)",
      args: [user.id, sha(token), Date.now() + RESET_TTL_MS],
    });
    return { token, user };
  } catch (e) {
    console.error("[admin-users] createResetToken failed:", (e as Error).message);
    return null;
  }
}

/** Consume a reset token and set the new password. One-time use. */
export async function consumeResetToken(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if ((newPassword || "").length < 10) return { ok: false, error: "Password must be at least 10 characters." };
  try {
    await ensureResetTable();
    const r = await libsql.execute({ sql: "SELECT * FROM password_resets WHERE token_hash = ? LIMIT 1", args: [sha(token)] });
    if (!r.rows.length) return { ok: false, error: "This reset link is invalid." };
    const row = r.rows[0] as unknown as Record<string, unknown>;
    if (Number(row.used) === 1) return { ok: false, error: "This reset link has already been used." };
    if (Number(row.expires_at) < Date.now()) return { ok: false, error: "This reset link has expired. Request a new one." };
    await updateUser(Number(row.user_id), { password: newPassword });
    await libsql.execute({ sql: "UPDATE password_resets SET used = 1 WHERE id = ?", args: [Number(row.id)] });
    return { ok: true };
  } catch (e) {
    console.error("[admin-users] consumeResetToken failed:", (e as Error).message);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

// ---- permissions ------------------------------------------------------------
export type Perm =
  | "products.view" | "products.edit" | "products.bulk" | "products.import" | "products.delete"
  | "orders.view" | "orders.edit"
  | "emails.view" | "emails.send"
  | "leads.view" | "leads.reply"
  | "content.view" | "content.edit"
  | "settings.manage" | "users.manage" | "deals.manage";

const ROLE_PERMS: Record<Role, Perm[] | "*"> = {
  super_admin: "*",
  manager: [
    "products.view", "products.edit", "products.bulk", "products.import",
    "orders.view", "orders.edit", "emails.view", "emails.send",
    "leads.view", "leads.reply", "content.view", "content.edit", "deals.manage",
  ],
  editor: ["products.view", "products.edit", "content.view", "content.edit", "leads.view"],
  viewer: ["products.view", "orders.view", "emails.view", "leads.view", "content.view"],
};

export function can(role: Role, perm: Perm): boolean {
  const p = ROLE_PERMS[role];
  return p === "*" || p.includes(perm);
}
