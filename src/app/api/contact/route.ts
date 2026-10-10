import { NextRequest, NextResponse } from "next/server";
import { sendMail, SHOP_EMAIL } from "@/lib/email";

function esc(s: string): string {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

export async function POST(req: NextRequest) {
  let b: Record<string, string>;
  try {
    b = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const name = (b.name ?? "").trim();
  const email = (b.email ?? "").trim();
  const message = (b.message ?? "").trim();
  if (!name || !email || !message) {
    return NextResponse.json({ error: "Please fill in your name, email and message." }, { status: 400 });
  }

  const html = `<h2>New contact enquiry</h2>
    <p><b>Name:</b> ${esc(name)}<br>
    <b>Email:</b> ${esc(email)}<br>
    <b>Phone:</b> ${esc(b.phone ?? "—")}<br>
    <b>Reason:</b> ${esc(b.reason ?? "—")}</p>
    <p><b>Message:</b><br>${esc(message).replace(/\n/g, "<br>")}</p>`;

  try {
    await sendMail(SHOP_EMAIL, `Website enquiry — ${name}`, html);
  } catch (e) {
    console.error("[contact] send failed", e);
    return NextResponse.json({ error: "Couldn't send right now. Please call us on 078 0088 788." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
