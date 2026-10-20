import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/contacts";
import { sendLeadEmail } from "@/lib/email";
import { validateContact } from "@/lib/validate";

export async function POST(req: NextRequest) {
  let b: Record<string, string>;
  try {
    b = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const reason = (b.reason ?? "").trim();
  const message = (b.message ?? "").trim();
  // Name, email and mobile must be real (same rules as the browser form).
  const { errors, clean } = validateContact({ name: b.name, email: b.email, phone: b.phone }, { name: true, email: true, phone: true });
  if (Object.keys(errors).length) {
    return NextResponse.json({ error: Object.values(errors)[0], errors }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  const { name, email, phone } = clean as { name: string; email: string; phone: string };
  const fullMessage = reason ? `Reason: ${reason}\n\n${message}` : message;

  // Record in Admin → Leads (Contact form tab). Never blocks the notification.
  await saveLead({ email, phone, name, source: "contact", message: fullMessage });

  try {
    await sendLeadEmail({ source: "contact", name, email, phone, message: fullMessage });
  } catch (e) {
    console.error("[contact] send failed", e);
    return NextResponse.json({ error: "Couldn't send right now. Please call us on 078 0088 788." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
