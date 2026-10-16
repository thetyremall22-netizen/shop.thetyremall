import { NextRequest, NextResponse } from "next/server";
import { createResetToken } from "@/lib/admin-users";
import { sendMail } from "@/lib/email";
import { clientIp, loginStatus, recordAttempt } from "@/lib/login-guard";

const BRAND = "#8ac53f";
const INK = "#14171a";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  // Reuse the login rate-limiter so this can't be used to spam/enumerate.
  const status = await loginStatus(ip);
  if (status.locked) return NextResponse.json({ ok: true }); // silent

  let email: string | undefined;
  let honeypot: string | undefined;
  try {
    ({ email, website: honeypot } = (await req.json()) as { email?: string; website?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Always respond the same way (no account enumeration).
  const generic = NextResponse.json({ ok: true });
  if (honeypot || !email) return generic;

  const created = await createResetToken(email);
  await recordAttempt(ip, false); // throttle repeated requests from one IP
  if (!created) return generic;

  const base = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const link = `${base}/admin/reset?token=${created.token}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:${INK}">
    <table role="presentation" width="100%" style="padding:24px 0"><tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
        <tr><td style="background:${INK};padding:18px 28px"><span style="font-size:20px;font-weight:800;color:#fff">THE TYRE <span style="color:${BRAND}">MALL</span> ADMIN</span></td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 14px;font-size:18px">Reset your admin password</h1>
          <p style="font-size:14px">We received a request to reset the password for this admin account. This link is valid for 1 hour and can be used once.</p>
          <p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:${BRAND};color:${INK};font-weight:800;text-decoration:none;padding:12px 22px;border-radius:10px">Reset password →</a></p>
          <p style="font-size:12px;color:#6b7280">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;

  try {
    await sendMail(created.user.email, "Reset your Tyre Mall admin password", html, { type: "custom", noCc: true });
  } catch (e) {
    console.error("[forgot] send failed:", (e as Error).message);
  }
  return generic;
}
