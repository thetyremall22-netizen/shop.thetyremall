import { NextRequest, NextResponse } from "next/server";
import { validateCoupon, type CouponItem } from "@/lib/coupons";
import { getProduct } from "@/lib/catalogue";
import { dealsForSlugs } from "@/lib/special-categories";

// Public: check a coupon against a cart and return the discount (for display).
// The authoritative discount is recomputed server-side at checkout.
export async function POST(req: NextRequest) {
  let body: { code?: string; items?: { slug: string; qty: number }[]; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ valid: false, error: "bad request" }, { status: 400 });
  }
  const code = (body.code ?? "").trim();
  if (!code) return NextResponse.json({ valid: false, error: "Enter a coupon code." });
  if (!Array.isArray(body.items) || !body.items.length) return NextResponse.json({ valid: false, error: "Your cart is empty." });

  // Re-price from the catalogue — never trust client prices.
  const items: CouponItem[] = [];
  for (const it of body.items) {
    const p = await getProduct(String(it.slug));
    if (!p) continue;
    items.push({ slug: p.slug, price: p.price, qty: Math.max(1, Math.floor(Number(it.qty) || 1)), type: p.type });
  }
  if (!items.length) return NextResponse.json({ valid: false, error: "Your cart is empty." });

  // Coupons don't apply to products that have a live special / sale deal.
  const deals = await dealsForSlugs(items.map((i) => i.slug)).catch(() => ({} as Record<string, unknown>));
  const eligible = items.filter((i) => !deals[i.slug]);
  if (!eligible.length) return NextResponse.json({ valid: false, error: "Coupons can't be used on deal products — the deal price already applies." });

  const res = await validateCoupon(code, { items: eligible, email: body.email });
  return NextResponse.json(res);
}
