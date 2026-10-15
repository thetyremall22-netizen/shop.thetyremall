import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sendComposedEmail, emailConfigured } from "@/lib/email";

// Compose + send an email to a customer from the admin panel. Always CCs the shop.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { to?: string; subject?: string; message?: string; orderRef?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(to)) return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured yet (set RESEND_API_KEY or SMTP_* in the environment)." }, { status: 503 });
  }

  try {
    await sendComposedEmail(to, subject, message, { orderRef: body.orderRef?.trim() || null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `Send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
