import { NextRequest, NextResponse } from "next/server";
import { getCustomer } from "@/lib/customers";
import { addToWishlist, removeFromWishlist, wishlistSlugs } from "@/lib/wishlist";
import { readJson } from "@/lib/customer-routes";

const MAX_ITEMS = 100;

export async function POST(req: NextRequest) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Sign in to save items to your wishlist.", signIn: true }, { status: 401 });
  const b = await readJson<{ slug?: string }>(req);
  if (!b?.slug) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const current = await wishlistSlugs(c.id);
  if (!current.includes(b.slug) && current.length >= MAX_ITEMS) return NextResponse.json({ error: `Your wishlist is full (${MAX_ITEMS} items). Remove something first.` }, { status: 400 });
  if (!(await addToWishlist(c.id, b.slug))) return NextResponse.json({ error: "That product isn't available any more." }, { status: 404 });
  return NextResponse.json({ ok: true, wishlist: await wishlistSlugs(c.id) });
}

export async function DELETE(req: NextRequest) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = await readJson<{ slug?: string }>(req);
  if (!b?.slug) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await removeFromWishlist(c.id, b.slug);
  return NextResponse.json({ ok: true, wishlist: await wishlistSlugs(c.id) });
}
