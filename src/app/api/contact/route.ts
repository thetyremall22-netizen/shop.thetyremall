import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/contacts";
import { sendLeadEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  let b: Record<string, string>;
  try {
    b = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const name = (b.name ?? "").trim();
  const email = (b.email ?? "").trim();
  const phone = (b.phone ?? "").trim();
  const reason = (b.reason ?? "").trim();
  const message = (b.message ?? "").trim();
  if (!name || !email || !message) {
    return NextResponse.json({ error: "Please fill in your name, email and message." }, { status: 400 });
  }
  const fullMessage = reason ? `Reason: ${reason}\n\n${message}` : message;

  // Record in Admin → Leads (Contact form tab). Never blocks the notification.
  await saveLead({ email, phone: phone || undefined, name, source: "contact", message: fullMessage });

  try {
    await sendLeadEmail({ source: "contact", name, email, phone: phone || undefined, message: fullMessage });
  } catch (e) {
    console.error("[contact] send failed", e);
    return NextResponse.json({ error: "Couldn't send right now. Please call us on 078 0088 788." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
