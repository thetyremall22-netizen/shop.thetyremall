import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SECRET = process.env.SESSION_SECRET || "dev-insecure-change-me";
const PASSWORD = process.env.ADMIN_PASSWORD || "tyremall-admin";
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
