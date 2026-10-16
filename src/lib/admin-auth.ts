import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserById, can, type Role, type Perm } from "./admin-users";

// No insecure fallbacks: SESSION_SECRET falls back to a RANDOM per-process
// secret (never a public default), and an unset ADMIN_PASSWORD means the
// break-glass owner login is disabled (fails closed).
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!process.env.SESSION_SECRET) console.warn("[admin-auth] SESSION_SECRET not set — using a random per-process secret (sessions reset on restart). Set it in production.");
if (!PASSWORD) console.warn("[admin-auth] ADMIN_PASSWORD not set — the break-glass owner login is disabled until it's configured.");
export const ADMIN_COOKIE = "ttm_admin";
export const ADMIN_MAXAGE = 60 * 60 * 24 * 7; // 7 days

/** Session subject: a numeric admin_users id, or "env" for the break-glass owner. */
export type Sub = string; // "env" | "<id>"

export interface SessionUser {
  id: number; // 0 for the env break-glass owner
  email: string;
  name: string;
  role: Role;
  active: boolean;
  isOwner: boolean; // env break-glass
}

function sign(sub: Sub, exp: number): string {
  return crypto.createHmac("sha256", SECRET).update(`admin.${sub}.${exp}`).digest("hex");
}

export function makeToken(sub: Sub): string {
  const exp = Date.now() + ADMIN_MAXAGE * 1000;
  return `${sub}.${exp}.${sign(sub, exp)}`;
}

/** Validate a token's signature + expiry and return its subject, or null. */
function parseToken(tok?: string): Sub | null {
  if (!tok) return null;
  const parts = tok.split(".");
  if (parts.length !== 3) return null;
  const [sub, expStr, mac] = parts;
  const exp = Number(expStr);
  if (!sub || !exp || exp < Date.now() || !mac) return null;
  const expected = sign(sub, exp);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return sub;
}

/** Break-glass owner password check (env ADMIN_PASSWORD), constant-time. */
export function checkPassword(pw: string): boolean {
  if (!PASSWORD) return false; // fail closed when no owner password is configured
  if (typeof pw !== "string" || pw.length !== PASSWORD.length) return false;
  return crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PASSWORD));
}

/** Resolve the current session to a user, or null. Disabled/deleted accounts
 *  are treated as logged-out immediately (role/active read fresh each request). */
export async function getAdminUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const sub = parseToken(c.get(ADMIN_COOKIE)?.value);
  if (!sub) return null;
  if (sub === "env") {
    return { id: 0, email: "(owner)", name: "Owner", role: "super_admin", active: true, isOwner: true };
  }
  const id = Number(sub);
  if (!Number.isFinite(id)) return null;
  const u = await getUserById(id);
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, isOwner: false };
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminUser()) !== null;
}

/** Use at the top of every protected admin page. Redirects to login if needed. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await getAdminUser();
  if (!u) redirect("/admin/login");
  return u;
}

/** Page-level permission gate: redirect to login if not signed in, or to the
 *  dashboard (access denied) if the role lacks the permission. */
export async function requirePermission(perm: Perm): Promise<SessionUser> {
  const u = await getAdminUser();
  if (!u) redirect("/admin/login");
  if (!can(u.role, perm)) redirect("/admin?denied=1");
  return u;
}

/** API-level authorization: returns the user if permitted, else null (the
 *  route returns 401/403). */
export async function authorize(perm: Perm): Promise<SessionUser | null> {
  const u = await getAdminUser();
  if (!u) return null;
  return can(u.role, perm) ? u : null;
}
