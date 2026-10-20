import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_COOKIE, CUSTOMER_FLAG, CUSTOMER_MAXAGE, makeCustomerToken } from "./customers";
import { clientIp, loginStatus, recordAttempt } from "./login-guard";

// Shared bits for the /api/account/* routes.

const secure = process.env.NODE_ENV === "production";

export async function signIn(res: NextResponse, customerId: number): Promise<NextResponse> {
  res.cookies.set(CUSTOMER_COOKIE, await makeCustomerToken(customerId), { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: CUSTOMER_MAXAGE });
  // Readable flag only (no secret): lets the browser know to load the wishlist.
  res.cookies.set(CUSTOMER_FLAG, "1", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: CUSTOMER_MAXAGE });
  return res;
}

export function signOut(res: NextResponse): NextResponse {
  res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(CUSTOMER_FLAG, "", { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/** Per-IP limit for sign-in attempts and for actions that send email
 *  (register, forgot password, support requests). Separate buckets per action. */
export async function limited(req: NextRequest, bucket: string): Promise<NextResponse | null> {
  const key = `cz-${bucket}:${clientIp(req)}`;
  const s = await loginStatus(key);
  if (s.locked) return NextResponse.json({ error: "Too many attempts. Please wait 15 minutes and try again." }, { status: 429 });
  return null;
}
export async function countAttempt(req: NextRequest, bucket: string, ok = false): Promise<void> {
  await recordAttempt(`cz-${bucket}:${clientIp(req)}`, ok);
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}

/** Public base URL for links in emails (never the internal localhost address). */
export function siteOrigin(req: NextRequest): string {
  const env = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

export const PASSWORD_MIN = 8;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
