"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { MegaSearch } from "./MegaSearch";
import { Cart, Menu, Close, Bolt, User, Heart } from "./icons";
import { PROMOS } from "@/lib/nav";
import { useCart } from "@/lib/cart";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Shop by Brands", href: "/shop" },
  { label: "The Tyre Shop", href: "/shop?type=tyre" },
  { label: "The Wheel Shop", href: "/shop?type=wheel" },
  { label: "Contact us", href: "/coming-soon?for=Contact%20us" },
];

export function Header() {
  const { totals, setDrawerOpen } = useCart();
  const [promoIdx, setPromoIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % PROMOS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      {/* promo ticker */}
      <div className="bg-volt text-volt-ink">
        <div className="container-x flex h-8 items-center justify-center gap-2 overflow-hidden text-center">
          <Bolt width={13} height={13} className="shrink-0" />
          <p key={promoIdx} className="rise text-[11px] font-extrabold tracking-wide">{PROMOS[promoIdx]}</p>
        </div>
      </div>

      {/* main bar */}
      <div className="border-b border-line bg-ink/95 backdrop-blur">
        <div className="container-x flex items-center gap-4 py-3">
          <button className="grid size-10 shrink-0 place-items-center rounded-lg text-fg lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </button>

          <Logo className="shrink-0" priority />

          {/* desktop nav */}
          <nav className="mx-auto hidden items-center gap-1 lg:flex">
            <Link href="/shop" className="mr-1 rounded-lg border border-volt/60 px-3.5 py-2 text-sm font-bold text-volt transition-colors hover:bg-volt hover:text-volt-ink">
              All Categories
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="rounded-md px-3.5 py-2 text-sm font-bold tracking-wide text-fg transition-colors hover:text-volt"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* right icons */}
          <div className="ml-auto flex items-center gap-1">
            <Link href="/coming-soon?for=Account" className="grid size-10 place-items-center rounded-lg text-fg hover:text-volt" aria-label="Account">
              <User />
            </Link>
            <Link href="/coming-soon?for=Wishlist" className="hidden size-10 place-items-center rounded-lg text-fg hover:text-volt sm:grid" aria-label="Wishlist">
              <Heart />
            </Link>
            <button onClick={() => setDrawerOpen(true)} className="relative grid size-10 place-items-center rounded-lg text-fg hover:text-volt" aria-label="Open cart">
              <Cart />
              {totals.itemCount > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-volt px-1 text-[11px] font-black text-volt-ink">
                  {totals.itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* permanent search bar (always visible under the menu) */}
        <div className="border-t border-line bg-ink">
          <div className="container-x py-2.5">
            <MegaSearch />
          </div>
        </div>
      </div>

      {/* mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[82%] max-w-80 overflow-y-auto bg-ink-2 p-5">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="text-muted"><Close /></button>
            </div>
            <div className="mt-5 flex flex-col">
              {NAV.map((n) => (
                <Link key={n.label} href={n.href} onClick={() => setMenuOpen(false)} className="border-b border-line py-3 font-bold tracking-wide text-fg">
                  {n.label}
                </Link>
              ))}
              <Link href="/coming-soon?for=Account" onClick={() => setMenuOpen(false)} className="py-3 font-medium text-muted">My Account</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
