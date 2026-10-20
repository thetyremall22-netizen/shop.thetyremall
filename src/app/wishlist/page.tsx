import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";
import { getCustomer } from "@/lib/customers";
import { listWishlist } from "@/lib/wishlist";
import { AccountFrame } from "@/components/account/AccountNav";
import { WishlistGrid } from "@/components/account/WishlistGrid";

export const instant = false;
export const metadata: Metadata = { title: "My wishlist", robots: { index: false, follow: false } };

export default async function WishlistPage() {
  await connection();
  const c = await getCustomer();
  if (!c) {
    return (
      <div className="container-x grid min-h-[50vh] place-items-center py-16 text-center">
        <div className="max-w-md">
          <div className="text-5xl text-sale" aria-hidden>♥</div>
          <h1 className="mt-3 font-display text-4xl">Your wishlist</h1>
          <p className="mt-3 text-muted">Sign in or create a free account to save tyres and wheels to your wishlist. It&apos;s kept safe on any device, and we can email you when your items go on sale or come back in stock.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/account?next=/wishlist" className="btn btn-volt">Sign in / Create account</Link>
            <Link href="/shop" className="btn btn-ghost">Browse tyres & wheels</Link>
          </div>
        </div>
      </div>
    );
  }
  const items = await listWishlist(c.id);
  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <h1 className="font-display text-3xl sm:text-4xl">My wishlist</h1>
      <p className="mt-1 text-sm text-muted">
        {c.wishlistEmails
          ? "We'll email you when something here goes on sale, drops in price or comes back in stock."
          : <>Wishlist emails are off. <Link href="/account/details" className="font-semibold text-volt hover:underline">Switch them on</Link> to hear when items go on sale or come back in stock.</>}
      </p>
      <WishlistGrid items={items} />
    </AccountFrame>
  );
}
