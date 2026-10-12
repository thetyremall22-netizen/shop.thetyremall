import { NextRequest, NextResponse } from "next/server";
import { saveLead, extractContact } from "@/lib/contacts";
import { sendMail, SHOP_EMAIL } from "@/lib/email";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);
  const source = str(body.source) ?? "tyrone";
  const message = str(body.message);

  // Accept explicit email/phone, or extract from a free-text message.
  let email = str(body.email);
  let phone = str(body.phone);
  if ((!email || !phone) && message) {
    const found = extractContact(message);
    email = email ?? found.email;
    phone = phone ?? found.phone;
  }

  const saved = await saveLead({ email, phone, name: str(body.name), source, message });

  if (saved) {
    sendMail(
      SHOP_EMAIL,
      `New contact lead${email ? ` — ${email}` : phone ? ` — ${phone}` : ""}`,
      `<p>A visitor shared their contact details via <b>${source}</b>:</p>
       <ul>${email ? `<li>Email: ${email}</li>` : ""}${phone ? `<li>Phone: ${phone}</li>` : ""}</ul>
       ${message ? `<p><b>Message:</b> ${message.replace(/</g, "&lt;")}</p>` : ""}
       <p>Follow up so the enquiry doesn't drop off.</p>`
    ).catch((e) => console.error("[lead] email failed", e));
  }

  return NextResponse.json({ ok: true, captured: saved });
}
