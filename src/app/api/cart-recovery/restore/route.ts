import { NextRequest, NextResponse } from "next/server";
import { getCartByToken, markClicked, getRecoverySettings } from "@/lib/cart-recovery";
import { getProduct } from "@/lib/catalogue";

/** The "Complete my order" link: marks the cart as clicked and returns what the
 *  browser needs to rebuild the cart and pre-fill checkout. */
export async function GET(req: NextRequest) {
  const cart = await getCartByToken(req.nextUrl.searchParams.get("t") ?? "");
  if (!cart) return NextResponse.json({ error: "This link has expired or is invalid." }, { status: 404 });
  await markClicked(cart.id);
  const settings = await getRecoverySettings();
  const items = [];
  for (const i of cart.items) {
    const p = await getProduct(i.slug).catch(() => undefined);
    if (!p) continue; // product no longer sold
    items.push({
      id: p.id, slug: p.slug, name: p.name, brand: p.brand, image: p.thumb ?? p.image, price: p.price, type: p.type,
      qty: i.qty, roadHazard: !!i.roadHazard, alignment: !!i.alignment, balanceQty: i.balanceQty ?? 0,
    });
  }
  const a = cart.address ?? {};
  return NextResponse.json({
    items,
    fields: {
      firstName: cart.firstName, lastName: cart.lastName, email: cart.email, phone: cart.phone,
      street: a.street ?? "", suburb: a.suburb ?? "", city: a.city ?? "", province: a.province ?? "", postalCode: a.postalCode ?? "",
    },
    couponCode: settings.discount.enabled && settings.discount.autoApply && settings.discount.code ? settings.discount.code : undefined,
  });
}
