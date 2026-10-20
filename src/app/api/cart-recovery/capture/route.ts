import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { captureCheckout, type RecoveryItem } from "@/lib/cart-recovery";
import { checkEmail, cleanEmail, normalizePhone } from "@/lib/validate";

const s = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Saves the shopper's cart + details as they fill in checkout, so a recovery
 *  email can go out if they don't finish. */
export async function POST(req: NextRequest) {
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }
  const email = s(b.email, 160);
  if (!email || checkEmail(email)) return NextResponse.json({ ok: false });
  const items: RecoveryItem[] = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map((x) => {
    const i = x as Record<string, unknown>;
    return {
      slug: s(i.slug, 200), name: s(i.name, 200), qty: Math.max(1, Math.min(99, Number(i.qty) || 1)), price: Math.max(0, Math.round(Number(i.price) || 0)),
      image: typeof i.image === "string" ? i.image.slice(0, 300) : null, roadHazard: !!i.roadHazard, alignment: !!i.alignment, balanceQty: Math.max(0, Math.min(8, Number(i.balanceQty) || 0)),
    };
  }).filter((i) => i.slug);
  if (!items.length) return NextResponse.json({ ok: false });
  const a = (b.address ?? {}) as Record<string, unknown>;
  await captureCheckout({
    email: cleanEmail(email),
    firstName: s(b.firstName, 80), lastName: s(b.lastName, 80),
    phone: normalizePhone(s(b.phone, 40)) ?? s(b.phone, 40),
    address: { street: s(a.street, 200), suburb: s(a.suburb), city: s(a.city), province: s(a.province, 60), postalCode: s(a.postalCode, 12) },
    items,
    total: Math.max(0, Math.round(Number(b.total) || items.reduce((n, i) => n + i.price * i.qty, 0))),
    test: await isAdmin(), // staff testing checkout
  });
  return NextResponse.json({ ok: true });
}
