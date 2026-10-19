import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getEmail, type EmailType } from "@/lib/email-log";
import { sendMail, emailConfigured } from "@/lib/email";

// Resend a logged email — optionally with an edited recipient/subject/body.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("emails.send"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const emailId = Number(id);
  if (!Number.isFinite(emailId)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const original = await getEmail(emailId);
  if (!original) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: { to?: string; subject?: string; html?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const to = (body.to ?? original.toAddr).trim();
  const subject = (body.subject ?? original.subject).trim();
  const html = body.html ?? original.html;
  if (!to || !subject || !html) return NextResponse.json({ error: "Recipient, subject and message are all required." }, { status: 400 });

  if (!(await emailConfigured())) {
    return NextResponse.json({ error: "Email isn't configured yet (set RESEND_API_KEY or SMTP_* in the environment)." }, { status: 503 });
  }

  try {
    await sendMail(to, subject, html, { type: original.type as EmailType, orderRef: original.orderRef, resend: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `Send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
