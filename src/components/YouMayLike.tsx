"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice, discountPct } from "@/lib/format";

export interface LikeItem {
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  price: number;
  regularPrice: number;
  size?: string;
  onSale: boolean;
}

export function YouMayLike({ items }: { items: LikeItem[] }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!items.length) return null;

  return (
    <div
      className={`mt-6 transition-all duration-700 ease-out ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"
      }`}
      aria-hidden={!show}
    >
      <h2 className="skew-italic font-display text-xl leading-none sm:text-2xl">
        <span className="text-chrome">WE THINK YOU&apos;LL</span> <span className="text-volt-grad">LIKE THESE</span>
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => {
          const pct = discountPct(it.regularPrice, it.price);
          const sale = it.onSale && pct > 0;
          return (
            <Link
              key={it.slug}
              href={`/product/${it.slug}`}
              className={`glow-hover group relative flex flex-col overflow-hidden rounded-xl bg-white text-[#14171a] shadow-lg shadow-black/20 ${
                sale ? "pulse-sale ring-2 ring-sale" : "ring-1 ring-black/5"
              }`}
            >
              <div className="relative aspect-square bg-white">
                {sale && (
                  <span className="absolute inset-x-0 top-0 z-10 bg-sale px-1 py-1 text-center text-[8.5px] font-black uppercase leading-[1.1] text-white">
                    On sale now!<br />Hurry — ends soon!
                  </span>
                )}
                {it.image && <Image src={it.image} alt={it.name} fill sizes="160px" className="object-contain p-2.5" />}
                {sale && <span className="badge badge-sale absolute bottom-1 left-1">-{pct}%</span>}
              </div>
              <div className="flex flex-1 flex-col border-t border-black/5 p-2">
                <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#4f7000]">{it.brand}</div>
                <div className="line-clamp-2 min-h-[2.5em] text-[11px] font-medium leading-snug">{it.name}</div>
                <div className="mt-auto flex items-end gap-1.5 pt-1">
                  {sale && <span className="text-[10px] text-neutral-400 line-through">{formatPrice(it.regularPrice)}</span>}
                  <span className="font-display text-sm text-[#14171a]">{formatPrice(it.price)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
