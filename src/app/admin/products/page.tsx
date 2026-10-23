import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listProducts, productTypeCounts, type AdminFilter, type ProductSort } from "@/lib/db/queries";
import { categories as BUILT_IN_CATEGORIES } from "@/lib/catalogue";
import { listSpecials } from "@/lib/special-categories";

const SORTS: ProductSort[] = ["stock_desc", "stock_asc", "price_desc", "price_asc", "name", "name_desc"];
import { AdminSearch } from "@/components/admin/AdminSearch";
import { ProductsToolbar } from "@/components/admin/ProductsToolbar";
import { ProductsTable } from "@/components/admin/ProductsTable";

export const instant = false;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = (sp.filter as AdminFilter) ?? "all";
  // Default: most stock first.
  const sort: ProductSort = SORTS.includes(sp.sort as ProductSort) ? (sp.sort as ProductSort) : "stock_desc";
  const page = Math.max(1, Number(sp.page) || 1);
  const type = sp.type === "tyre" || sp.type === "wheel" || sp.type === "other" ? sp.type : undefined;
  const [{ rows, total, perPage }, counts, specials] = await Promise.all([
    listProducts({ q, filter, page, perPage: 25, type, sort }),
    productTypeCounts(),
    listSpecials(),
  ]);
  const catName = new Map<string, string>([...BUILT_IN_CATEGORIES.map((c) => [c.slug, c.name] as [string, string]), ...specials.map((s) => [s.slug, `${s.kind === "sale" ? "%" : "★"} ${s.name}`] as [string, string])]);
  const tableRows = rows.map((r) => {
    let cats: string[] = [];
    try { cats = JSON.parse(r.categories || "[]"); } catch { /* none */ }
    return { ...r, categoryNames: cats.map((c) => catName.get(c) ?? c) };
  });
  const TYPE_TABS = [
    { v: "", label: "All products", n: counts.all },
    { v: "tyre", label: "Tyres", n: counts.tyre },
    { v: "wheel", label: "Wheels / Rims", n: counts.wheel },
    { v: "other", label: "Other products", n: counts.other },
  ];
  const pages = Math.max(1, Math.ceil(total / perPage));

  const filters: { k: AdminFilter; label: string }[] = [
    { k: "all", label: "All" }, { k: "instock", label: "In stock" }, { k: "low", label: "Low stock" },
    { k: "out", label: "Out of stock" }, { k: "sale", label: "On sale" },
  ];
  const qs = (patch: Record<string, string | number>) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (filter !== "all") u.set("filter", filter);
    if (type) u.set("type", type);
    if (sort !== "stock_desc") u.set("sort", sort);
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
          if (sort !== "stock_desc") u.set("sort", sort);
          const href = u.toString() ? `/admin/products?${u}` : "/admin/products";
          return (
            <Link key={t.label} href={href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label} <span className="opacity-70">({t.n.toLocaleString()})</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link href="/admin/products/brands" className="inline-flex rounded-full border border-volt/50 px-3.5 py-1.5 text-sm font-semibold text-volt hover:bg-volt/10">🏷 Brands &amp; logos →</Link>
        <Link href="/admin/products/google-merchant" className="inline-flex rounded-full border border-volt/50 px-3.5 py-1.5 text-sm font-semibold text-volt hover:bg-volt/10">🛍 Google Merchant feed →</Link>
        <Link href="/admin/products/specials" className="inline-flex rounded-full border border-volt/50 px-3.5 py-1.5 text-sm font-semibold text-volt hover:bg-volt/10">★ Special categories →</Link>
        <Link href="/admin/products/specials?kind=sale" className="inline-flex rounded-full border border-volt/50 px-3.5 py-1.5 text-sm font-semibold text-volt hover:bg-volt/10">% Sale categories →</Link>
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
        <ProductsTable rows={tableRows} q={q} filter={filter} type={type} total={total} sort={sort}
          sortLinks={Object.fromEntries(SORTS.map((s) => [s, qs({ sort: s, page: 1 }).replace(/sort=stock_desc&?/, "").replace(/[?&]$/, "")]))} />
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
