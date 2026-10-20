import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listProducts, productTypeCounts, type AdminFilter } from "@/lib/db/queries";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { ProductsToolbar } from "@/components/admin/ProductsToolbar";
import { ProductsTable } from "@/components/admin/ProductsTable";

export const instant = false;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = (sp.filter as AdminFilter) ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const type = sp.type === "tyre" || sp.type === "wheel" || sp.type === "other" ? sp.type : undefined;
  const [{ rows, total, perPage }, counts] = await Promise.all([
    listProducts({ q, filter, page, perPage: 25, type }),
    productTypeCounts(),
  ]);
  const TYPE_TABS = [
    { v: "", label: "All products", n: counts.all },
    { v: "tyre", label: "Tyres", n: counts.tyre },
    { v: "wheel", label: "Wheels / Rims", n: counts.wheel },
    { v: "other", label: "Other products", n: counts.other },
  ];
  const pages = Math.max(1, Math.ceil(total / perPage));

  const filters: { k: AdminFilter; label: string }[] = [
    { k: "all", label: "All" }, { k: "low", label: "Low stock" },
    { k: "out", label: "Out of stock" }, { k: "sale", label: "On sale" },
  ];
  const qs = (patch: Record<string, string | number>) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (filter !== "all") u.set("filter", filter);
    if (type) u.set("type", type);
    for (const [k, v] of Object.entries(patch)) u.set(k, String(v));
    return `/admin/products?${u.toString()}`;
  };

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Products <span className="text-base text-muted">({total.toLocaleString()})</span></h1>
      </div>
      <AdminSearch className="mt-3 max-w-xl" placeholder="Search name, SKU, brand, category or size (e.g. 265/65R17)…" />

      <div className="mt-4 flex flex-wrap gap-2">
        {TYPE_TABS.map((t) => {
          const active = (type ?? "") === t.v;
          const u = new URLSearchParams();
          if (q) u.set("q", q);
          if (filter !== "all") u.set("filter", filter);
          if (t.v) u.set("type", t.v);
          const href = u.toString() ? `/admin/products?${u}` : "/admin/products";
          return (
            <Link key={t.label} href={href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label} <span className="opacity-70">({t.n.toLocaleString()})</span>
            </Link>
          );
        })}
      </div>
      {type === "other" && counts.other === 0 && (
        <p className="mt-3 text-sm text-muted">No other products yet. When you add a product that isn&apos;t a tyre or wheel (e.g. valves, nuts, accessories), set its type to “Other” and it will appear here.</p>
      )}
      <div className="mt-3"><ProductsToolbar /></div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f.k} href={qs({ filter: f.k, page: 1 }).replace(/filter=all&?/, "")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === f.k ? "border-volt bg-volt/10 text-volt" : "border-line text-muted hover:text-fg"}`}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <ProductsTable rows={rows} q={q} filter={filter} type={type} total={total} />
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={qs({ page: page - 1 })} className="btn btn-ghost h-9 px-4 text-sm">← Prev</Link>}
            {page < pages && <Link href={qs({ page: page + 1 })} className="btn btn-ghost h-9 px-4 text-sm">Next →</Link>}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
