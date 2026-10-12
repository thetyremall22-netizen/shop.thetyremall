import { NextRequest, NextResponse } from "next/server";
import { captureAbandoned, type AbandonedItem } from "@/lib/abandoned";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false }, { status: 200 });

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: AbandonedItem[] = rawItems.slice(0, 40).map((i: Record<string, unknown>) => ({
    name: String(i.name ?? "").slice(0, 200),
    qty: Number(i.qty) || 1,
    price: Number(i.price) || 0,
    slug: typeof i.slug === "string" ? i.slug : undefined,
    image: typeof i.image === "string" ? i.image : null,
  }));
  const total = Number(body.total) || items.reduce((n, i) => n + i.price * i.qty, 0);
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : undefined;

  await captureAbandoned(email, items, total, phone);
  return NextResponse.json({ ok: true });
}
