import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customers";
import { wishlistSlugs } from "@/lib/wishlist";

// Who's signed in (for checkout pre-fill and the wishlist hearts).
export async function GET() {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ signedIn: false }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({
    signedIn: true,
    customer: { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, address: c.address },
    wishlist: await wishlistSlugs(c.id).catch(() => []),
  }, { headers: { "Cache-Control": "no-store" } });
}
