"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/leads", label: "Leads & Enquiries" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

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
            <button onClick={logout} className="mt-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-surface hover:text-sale">
              Log out
            </button>
            <Link href="/" className="rounded-lg px-3 py-2 text-left text-xs text-faint hover:text-fg">← View store</Link>
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
