"use client";

import Link from "next/link";
import { categoryPath } from "@/lib/shop-url";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { MegaSearch } from "./MegaSearch";
import { BrandTile } from "./BrandTile";
import { Cart, Menu, Close, Bolt, User, Heart, Chevron } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { PROMOS, NAV_PRIMARY } from "@/lib/nav";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/lib/account-client";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Tyre Mall", href: "/product-category/tyres" },
  { label: "Wheel Mall", href: "/product-category/mag-wheel" },
  { label: "Find by Vehicle", href: "/vehicle-search" },
  { label: "Contact us", href: "/contact-us/" },
];


export function Header({ brands = [] }: { brands?: { name: string; logo: string | null }[] }) {
  const { totals, setDrawerOpen } = useCart();
  const { signedIn, wishlist } = useAccount();
  const wishCount = wishlist.length;
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
        <div className="container-x flex h-7 items-center justify-center gap-2 overflow-hidden text-center">
          <Bolt width={13} height={13} className="shrink-0" />
          <p key={promoIdx} className="rise text-[11px] font-extrabold tracking-wide">{PROMOS[promoIdx]}</p>
        </div>
      </div>

      {/* main bar */}
      <div className="border-b border-line bg-ink/95 backdrop-blur">
        <div className="container-x flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
          <button className="grid size-10 shrink-0 place-items-center rounded-lg text-fg lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </button>

          {/* Logo — larger */}
          <Logo className="shrink-0" priority />

          {/* mobile actions (desktop shows these inside the column below) */}
          <div className="ml-auto flex items-center gap-0 lg:hidden [&>*]:!size-9">
            <ThemeToggle />
            <Link href="/account" className="grid size-10 place-items-center rounded-lg text-fg hover:text-volt" aria-label="Account">
              <User />
            </Link>
            <Link href="/wishlist" className="relative grid size-10 place-items-center rounded-lg text-fg hover:text-volt" aria-label="Wishlist">
              <Heart />
              {wishCount > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sale px-1 text-[11px] font-black text-white">{wishCount}</span>
              )}
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

          {/* right column: nav + icons on top (desktop), compact search below.
              On mobile this wraps to full width beneath the logo. */}
          <div className="order-last flex w-full flex-col gap-2 lg:order-none lg:w-auto lg:flex-1">
            <div className="hidden items-center gap-1 lg:flex">
              <nav className="flex items-center gap-1">
                <div className="group relative mr-1">
                  <Link
                    href="/shop"
                    className="flex items-center gap-1 rounded-lg border border-volt/60 px-3.5 py-2 text-sm font-bold text-volt transition-colors group-hover:bg-volt group-hover:text-volt-ink"
                  >
                    All Categories <Chevron width={14} height={14} className="transition-transform group-hover:rotate-180" />
                  </Link>
                  <div className="invisible absolute left-0 top-full z-50 w-56 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                    <div className="overflow-hidden rounded-xl border border-line bg-ink-2 shadow-2xl shadow-black/60">
                      {NAV_PRIMARY.map((c) => (
                        <Link
                          key={c.slug}
                          href={categoryPath(c.slug)}
                          className="block px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface hover:text-volt"
                        >
                          {c.slug === "mag-wheel" ? c.label : `${c.label} Tyres`}
                        </Link>
                      ))}
                      <Link href="/shop" className="block border-t border-line px-4 py-2.5 text-sm font-bold text-volt transition-colors hover:bg-surface">
                        View all →
                      </Link>
                    </div>
                  </div>
                </div>
                <Link href="/" className="rounded-md px-3 py-2 text-sm font-bold tracking-wide text-fg transition-colors hover:text-volt">Home</Link>

                {/* Shop by Brands — click goes to shop, hover opens the brand mega menu */}
                <div className="group relative">
                  <Link href="/shop" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-bold tracking-wide text-fg transition-colors group-hover:text-volt">
                    Shop by Brands <Chevron width={14} height={14} className="transition-transform group-hover:rotate-180" />
                  </Link>
                  <div className="invisible absolute left-1/2 top-full z-50 w-screen max-w-3xl -translate-x-1/2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                    <div className="overflow-hidden rounded-2xl border border-line bg-ink-2 p-5 shadow-2xl shadow-black/70">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="eyebrow">Shop by tyre brand</span>
                        <Link href="/shop" className="text-xs font-bold text-volt hover:underline">View all →</Link>
                      </div>
                      <div className="grid grid-cols-4 gap-2.5 lg:grid-cols-6">
                        {brands.map((b) => (
                          <BrandTile key={b.name} brand={b.name} logo={b.logo} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {NAV.filter((n) => n.label !== "Home").map((n) => (
                  <Link
                    key={n.label}
                    href={n.href}
                    className="rounded-md px-3 py-2 text-sm font-bold tracking-wide text-fg transition-colors hover:text-volt"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>

              {/* desktop icons */}
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <Link href="/account" className="grid size-10 place-items-center rounded-lg text-fg hover:text-volt" aria-label="Account">
                  <User />
                </Link>
                <Link href="/wishlist" className="relative grid size-10 place-items-center rounded-lg text-fg hover:text-volt" aria-label="Wishlist">
                  <Heart />
                  {wishCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-sale px-1 text-[11px] font-black text-white">{wishCount}</span>
                  )}
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
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Shop by category</div>
                {NAV_PRIMARY.map((c) => (
                  <Link key={c.slug} href={categoryPath(c.slug)} onClick={() => setMenuOpen(false)} className="block py-2 text-sm font-medium text-fg">
                    {c.label} Tyres
                  </Link>
                ))}
              </div>
              <Link href="/account" onClick={() => setMenuOpen(false)} className="mt-3 border-t border-line py-3 font-medium text-muted">{signedIn ? "My Account" : "Sign in / Register"}</Link>
              <Link href="/wishlist" onClick={() => setMenuOpen(false)} className="border-t border-line py-3 font-medium text-muted">My Wishlist{wishCount > 0 ? ` (${wishCount})` : ""}</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
