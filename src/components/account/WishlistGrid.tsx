"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/lib/account-client";
import { formatPrice } from "@/lib/format";

export interface WishItem { id: number; slug: string; name: string; brand: string; type: string; image: string | null; price: number; regularPrice: number; onSale: boolean; inStock: boolean; available: boolean }

export function WishlistGrid({ items }: { items: WishItem[] }) {
  const router = useRouter();
  const { add } = useCart();
  const { toggle } = useAccount();
  const [gone, setGone] = useState<string[]>([]);
  const shown = items.filter((i) => !gone.includes(i.slug));

  async function remove(slug: string) {
    setGone((g) => [...g, slug]);
    await toggle(slug);
    router.refresh();
  }

  if (shown.length === 0) {
    return (
      <div className="card mt-6 p-6 text-center">
        <div className="text-4xl text-sale" aria-hidden>♡</div>
        <p className="mt-2 text-sm text-muted">Your wishlist is empty. Tap the heart on any tyre or wheel to save it here.</p>
        <Link href="/shop" className="btn btn-volt mt-4">Browse tyres & wheels</Link>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map((i) => {
        const was = i.onSale && i.regularPrice > i.price ? i.regularPrice : 0;
        return (
          <div key={i.slug} className="flex gap-3 rounded-[14px] bg-white p-3 text-[#14171a] ring-1 ring-black/5">
            <Link href={`/product/${i.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-white">
              {i.image ? <Image src={i.image} alt={i.name} fill sizes="96px" className="object-contain p-1" /> : <span className="grid size-full place-items-center text-xs text-neutral-400">No image</span>}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#4f7000]">{i.brand}</span>
              <Link href={`/product/${i.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-[#4f7000]">{i.name}</Link>
              {i.available ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-lg">{formatPrice(i.price)}</span>
                  {was > 0 && <span className="text-xs text-[#9aa1a9] line-through">{formatPrice(was)}</span>}
                  {i.onSale && <span className="badge badge-sale">ON SALE</span>}
                </div>
              ) : <span className="mt-1 text-xs font-semibold text-[#b42318]">No longer available</span>}
              <span className={`text-xs font-semibold ${i.inStock ? "text-[#2f7d32]" : "text-[#b42318]"}`}>
                {!i.available ? "" : i.inStock ? "In stock" : "Out of stock — we'll email you when it's back"}
              </span>
              <div className="mt-auto flex items-center gap-3 pt-2">
                {i.available && i.inStock && (
                  <button className="rounded-lg bg-[#8ac53f] px-3 py-1.5 text-xs font-extrabold text-[#14171a] hover:brightness-110"
                    onClick={() => add({ id: i.id, slug: i.slug, name: i.name, brand: i.brand, image: i.image, price: i.price, type: (i.type as "tyre" | "wheel" | "other") ?? "tyre", roadHazard: false })}>
                    Add to cart
                  </button>
                )}
                <button className="text-xs font-bold text-[#5c646d] hover:text-[#b42318]" onClick={() => remove(i.slug)}>Remove</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
