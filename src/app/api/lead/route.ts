import { NextRequest, NextResponse } from "next/server";
import { saveLead, extractContact } from "@/lib/contacts";
import { sendLeadEmail } from "@/lib/email";

// Single entry point for every website lead that carries contact details:
// the WhatsApp quote panel, the WhatsApp product-enquiry pre-step, and Tyrone.
// Saves to Admin → Leads (under its source tab) AND emails the shop with ALL
// details. The contact page posts to /api/contact, which saves the same way.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);
  const source = str(body.source) ?? "tyrone";
  const message = str(body.message);

  // Accept explicit email/phone, or extract from a free-text message (Tyrone).
  let email = str(body.email);
  let phone = str(body.phone);
  if ((!email || !phone) && message) {
    const found = extractContact(message);
    email = email ?? found.email;
    phone = phone ?? found.phone;
  }
  const name = str(body.name);
  const productName = str(body.productName);
  const sku = str(body.sku);
  const productUrl = str(body.productUrl);
  const price = typeof body.price === "number" ? body.price : undefined;

  const saved = await saveLead({ email, phone, name, source, message, productName, sku, productUrl });

  if (saved) {
    sendLeadEmail({ source, name, email, phone, productName, sku, price, productUrl, message })
      .catch((e) => console.error("[lead] email failed", e));
  }

  return NextResponse.json({ ok: true, captured: saved });
}
