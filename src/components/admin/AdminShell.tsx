"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const BASE_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/leads", label: "Leads & Enquiries" },
  { href: "/admin/cart-recovery", label: "Abandoned Cart" },
];

interface Me { name: string; email: string; role: string; isOwner: boolean; canManageUsers: boolean; canManageSettings: boolean; canManageDeals: boolean; canEditContent: boolean }
const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", manager: "Manager", editor: "Editor", viewer: "Viewer" };

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let on = true;
    fetch("/api/admin/me").then((r) => (r.ok ? r.json() : null)).then((d) => { if (on) setMe(d); }).catch(() => {});
    return () => { on = false; };
  }, []);

  const NAV = [
    ...BASE_NAV,
    ...(me?.canEditContent ? [{ href: "/admin/content", label: "Content" }] : []),
    ...(me?.canEditContent ? [{ href: "/admin/media", label: "Media" }] : []),
    ...(me?.canEditContent ? [{ href: "/admin/reviews", label: "Reviews" }] : []),
    ...(me?.canEditContent ? [{ href: "/admin/theme", label: "Theme" }] : []),
    ...(me?.canEditContent ? [{ href: "/admin/strings", label: "Wording" }] : []),
    ...(me?.canManageDeals ? [{ href: "/admin/coupons", label: "Coupons" }] : []),
    ...(me?.canManageSettings ? [{ href: "/admin/payments", label: "Payments" }] : []),
    ...(me?.canManageSettings ? [{ href: "/admin/settings", label: "Settings" }] : []),
    ...(me?.canManageUsers ? [{ href: "/admin/users", label: "Staff & roles" }] : []),
  ];

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="container-x py-6">
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-4 font-display text-lg">
            <span className="text-chrome">TTM</span> <span className="text-volt-grad">ADMIN</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map((n) => {
              const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active ? "bg-volt text-volt-ink" : "text-fg hover:bg-surface hover:text-volt"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            {me && (
              <div className="mt-3 rounded-lg border border-line px-3 py-2 text-xs">
                <div className="truncate font-semibold text-fg">{me.isOwner ? "Owner" : me.name || me.email}</div>
                <div className="text-muted">{ROLE_LABEL[me.role] ?? me.role}</div>
              </div>
            )}
            <button onClick={logout} className="mt-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-surface hover:text-sale">
              Log out
            </button>
            <Link href="/" className="rounded-lg px-3 py-2 text-left text-xs text-faint hover:text-fg">← View store</Link>
          </nav>
        </aside>
        <main className="min-w-0">
          <form role="search" action="/admin/search" className="mb-5 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden>⌕</span>
              <input name="q" type="search" placeholder="Search everything: order no., customer name, email, phone, product, SKU, lead…"
                aria-label="Search the whole admin"
                className="h-10 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-volt" />
            </div>
            <button className="btn btn-dark h-10 px-4 text-sm">Search all</button>
          </form>
          {children}
        </main>
      </div>
    </div>
  );
}
