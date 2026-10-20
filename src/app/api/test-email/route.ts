import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sendMail, emailConfigured, SHOP_EMAIL } from "@/lib/email";

/** Verify SMTP from Vercel without placing an order.
 *  Call: /api/test-email?key=YOUR_CRON_SECRET
 *  Sends a test to shop@thetyremall.co.za (plus whatever EMAIL_CC is set to).
 *  Only ever emails the fixed shop address — never an arbitrary recipient. */
export async function GET(req: NextRequest) {
  await connection(); // never prerender — read live config + send at request time
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized — add ?key=CRON_SECRET" }, { status: 401 });
  }
  if (!(await emailConfigured())) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "Email not configured — set it in Admin → Settings → Email (SMTP host/user/password, or a Resend API key).",
    });
  }
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#14171a">
    <table role="presentation" width="100%" style="padding:24px 0"><tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
        <tr><td style="background:#14171a;padding:20px 28px">
          <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:.5px">THE TYRE <span style="color:#8ac53f">MALL</span></span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:20px">SMTP test successful ✅</h1>
          <p style="font-size:14px;margin:0 0 8px">If you can read this, the site can send email on its own — sent straight from this website's own mail settings.</p>
          <p style="font-size:13px;color:#6b7280;margin:0">Sent ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} (SAST).</p>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
  try {
    await sendMail(SHOP_EMAIL, "The Tyre Mall — SMTP test ✅", html);
    return NextResponse.json({ ok: true, configured: true, sentTo: SHOP_EMAIL, note: "Also CC'd per EMAIL_CC. Check the inbox(es)." });
  } catch (e) {
    // Surface the real SMTP error (e.g. M365 auth / SMTP AUTH disabled) so it's diagnosable.
    return NextResponse.json({ ok: false, configured: true, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
