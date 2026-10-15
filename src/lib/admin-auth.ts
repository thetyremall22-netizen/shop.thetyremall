import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// No insecure fallbacks: SESSION_SECRET falls back to a RANDOM per-process
// secret (never a public default), and an unset ADMIN_PASSWORD means admin
// login is disabled (fails closed) rather than using a guessable default.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!process.env.SESSION_SECRET) console.warn("[admin-auth] SESSION_SECRET not set — using a random per-process secret (sessions reset on restart). Set it in production.");
if (!PASSWORD) console.warn("[admin-auth] ADMIN_PASSWORD not set — admin login is disabled until it's configured.");
export const ADMIN_COOKIE = "ttm_admin";
export const ADMIN_MAXAGE = 60 * 60 * 24 * 7; // 7 days

function sign(exp: number): string {
  return crypto.createHmac("sha256", SECRET).update(`admin.${exp}`).digest("hex");
}

export function makeToken(): string {
  const exp = Date.now() + ADMIN_MAXAGE * 1000;
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(tok?: string): boolean {
  if (!tok) return false;
  const [expStr, mac] = tok.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now() || !mac) return false;
  const expected = sign(exp);
  return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

export function checkPassword(pw: string): boolean {
  if (!PASSWORD) return false; // fail closed when no admin password is configured
  if (typeof pw !== "string" || pw.length !== PASSWORD.length) return false;
  return crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PASSWORD));
}

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return verifyToken(c.get(ADMIN_COOKIE)?.value);
}

/** Use at the top of every protected admin page/route. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
