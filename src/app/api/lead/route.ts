import { NextRequest, NextResponse } from "next/server";
import { saveLead, extractContact } from "@/lib/contacts";
import { sendLeadEmail } from "@/lib/email";
import { validateContact } from "@/lib/validate";

// Single entry point for every website lead that carries contact details: the
// WhatsApp quote panel, the "Before we chat" step on every WhatsApp button, and
// Tyrone. Saves to Admin → Leads (under its source tab) AND emails the shop with
// ALL details. The contact page posts to /api/contact, which saves the same way.

// Forms: a valid name, email and mobile are mandatory (same rules as the browser).
const FORM_SOURCES = new Set(["whatsapp-quote", "whatsapp-enquiry", "whatsapp-chat"]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);
  const source = str(body.source) ?? "tyrone";
  if (!FORM_SOURCES.has(source) && source !== "tyrone") {
    return NextResponse.json({ error: "Unknown form." }, { status: 400 });
  }
  const message = str(body.message);
  let name = str(body.name);
  let email = str(body.email);
  let phone = str(body.phone);

  // Tyrone's "before we chat" step sends structured details: same strict rules.
  const tyroneStart = source === "tyrone" && !!(name || email || phone);
  if (FORM_SOURCES.has(source) || tyroneStart) {
    const { errors, clean } = validateContact({ name, email, phone }, { name: true, email: true, phone: true });
    if (Object.keys(errors).length) {
      return NextResponse.json({ error: Object.values(errors)[0], errors }, { status: 400 });
    }
    ({ name, email, phone } = clean);
  } else {
    // Tyrone chat: details come out of free text, so keep only the ones that
    // are genuinely valid rather than rejecting the chat message.
    if ((!email || !phone) && message) {
      const found = extractContact(message);
      email = email ?? found.email;
      phone = phone ?? found.phone;
    }
    const { clean } = validateContact({ name, email, phone }, {});
    ({ name, email, phone } = clean);
  }

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
