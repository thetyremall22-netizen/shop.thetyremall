import { NextRequest, NextResponse } from "next/server";
import { logEnquiry, type EnquiryType } from "@/lib/enquiries";
import { sendEnquiryEmail } from "@/lib/email";

const TYPES = new Set<EnquiryType>(["whatsapp", "tyrone", "call"]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const type = String(body.type ?? "") as EnquiryType;
  if (!TYPES.has(type)) return NextResponse.json({ error: "bad type" }, { status: 400 });

  const price = typeof body.price === "number" ? body.price : undefined;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);

  // Record to the custom backend DB.
  await logEnquiry({
    type,
    productSlug: str(body.productSlug),
    productName: str(body.productName),
    sku: str(body.sku),
    price,
    message: str(body.message),
    storeId: str(body.storeId),
    storeName: str(body.storeName),
  });

  // Email the shop immediately for product enquiries (calls go into the weekly
  // digest instead, to avoid an email per tap).
  if (type === "whatsapp" || type === "tyrone") {
    sendEnquiryEmail({
      type,
      productName: str(body.productName),
      sku: str(body.sku),
      price,
      productUrl: str(body.productUrl),
      message: str(body.message),
    }).catch((e) => console.error("[enquiry] email failed", e));
  }

  return NextResponse.json({ ok: true });
}
