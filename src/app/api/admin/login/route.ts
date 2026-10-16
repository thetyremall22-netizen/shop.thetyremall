import { NextRequest, NextResponse } from "next/server";
import { checkPassword, makeToken, ADMIN_COOKIE, ADMIN_MAXAGE } from "@/lib/admin-auth";
import { getUserForAuth, verifyPassword, recordLogin } from "@/lib/admin-users";
import { clientIp, loginStatus, recordAttempt } from "@/lib/login-guard";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sessionResponse(sub: string) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(sub), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_MAXAGE,
    path: "/",
  });
  return res;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // 1. Brute-force / bot lock-out (DB-backed, holds across serverless instances).
  const status = await loginStatus(ip);
  if (status.locked) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 15 minutes and try again." },
      { status: 429, headers: { "Retry-After": String(status.retryAfter) } },
    );
  }

  let email: string | undefined;
  let password: string | undefined;
  let honeypot: string | undefined;
  try {
    ({ email, password, website: honeypot } = (await req.json()) as { email?: string; password?: string; website?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // 2. Honeypot — a hidden field no human fills.
  if (honeypot) {
    await recordAttempt(ip, false);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const pw = password ?? "";

  // 3. Break-glass owner login (env ADMIN_PASSWORD) — works with no email, so
  //    the owner can always get in to create staff accounts.
  if (pw && checkPassword(pw)) {
    await recordAttempt(ip, true);
    return sessionResponse("env");
  }

  // 4. Staff account login by email + password.
  if (email && pw) {
    const user = await getUserForAuth(email);
    if (user && user.active && verifyPassword(pw, user.passwordHash)) {
      await recordAttempt(ip, true);
      await recordLogin(user.id);
      return sessionResponse(String(user.id));
    }
  }

  // Generic failure (don't reveal which part was wrong).
  await recordAttempt(ip, false);
  await sleep(600);
  return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
}
