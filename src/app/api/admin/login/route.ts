import { NextRequest, NextResponse } from "next/server";
import { checkPassword, makeToken, ADMIN_COOKIE, ADMIN_MAXAGE } from "@/lib/admin-auth";
import { clientIp, loginStatus, recordAttempt } from "@/lib/login-guard";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  let password: string | undefined;
  let honeypot: string | undefined;
  try {
    ({ password, website: honeypot } = (await req.json()) as { password?: string; website?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // 2. Honeypot — a hidden field no human fills. Bots that auto-fill forms get
  //    a generic failure and the attempt is counted against them.
  if (honeypot) {
    await recordAttempt(ip, false);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  if (!checkPassword(password ?? "")) {
    await recordAttempt(ip, false);
    // Small delay slows automated guessing and masks timing differences.
    await sleep(600);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  await recordAttempt(ip, true); // success clears this IP's failure history
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_MAXAGE,
    path: "/",
  });
  return res;
}
