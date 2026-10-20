"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./TokenActions";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "My orders" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/account/support", label: "Support" },
  { href: "/account/details", label: "My details" },
];

export function AccountNav({ name }: { name: string }) {
  const path = usePathname();
  return (
    <aside className="min-w-0 lg:sticky lg:top-40 lg:h-fit">
      <div className="mb-3 hidden lg:block">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Client zone</div>
        <div className="font-display text-xl">{name}</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col">
        {LINKS.map((l) => {
          const on = l.href === "/account" ? path === "/account" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${on ? "bg-volt text-volt-ink" : "text-muted hover:bg-surface-2 hover:text-fg"}`}>{l.label}</Link>
          );
        })}
        <SignOutButton className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-surface-2 hover:text-sale" />
      </nav>
    </aside>
  );
}

export function AccountFrame({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="container-x py-8 lg:py-12">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <AccountNav name={name} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
