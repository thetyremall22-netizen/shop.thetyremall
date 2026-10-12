import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listProducts, type AdminFilter } from "@/lib/db/queries";
import { ProductsToolbar } from "@/components/admin/ProductsToolbar";

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

export const instant = false;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = (sp.filter as AdminFilter) ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, perPage } = await listProducts({ q, filter, page, perPage: 25 });
  const pages = Math.max(1, Math.ceil(total / perPage));

  const filters: { k: AdminFilter; label: string }[] = [
    { k: "all", label: "All" }, { k: "low", label: "Low stock" },
    { k: "out", label: "Out of stock" }, { k: "sale", label: "On sale" },
  ];
  const qs = (patch: Record<string, string | number>) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (filter !== "all") u.set("filter", filter);
    for (const [k, v] of Object.entries(patch)) u.set(k, String(v));
    return `/admin/products?${u.toString()}`;
  };

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Products <span className="text-base text-muted">({total.toLocaleString()})</span></h1>
        <form className="flex gap-2" action="/admin/products">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Search name, SKU, brand…" className="h-9 w-56 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
          <button className="btn btn-volt h-9 px-4 text-sm">Search</button>
        </form>
      </div>
      <div className="mt-3"><ProductsToolbar /></div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f.k} href={qs({ filter: f.k, page: 1 }).replace(/filter=all&?/, "")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === f.k ? "border-volt bg-volt/10 text-volt" : "border-line text-muted hover:text-fg"}`}>
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Stock</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const low = p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
              return (
                <tr key={p.slug} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-fg">{p.name}</div>
                    <div className="text-xs text-muted">{p.brand} · {p.sku || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {p.onSale ? <><span className="text-faint line-through">{zar(p.regularPrice)}</span> <span className="font-semibold text-fg">{zar(p.salePrice)}</span></> : <span className="font-semibold text-fg">{zar(p.price)}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.stockQty === 0
                      ? <span className="font-semibold text-sale">Out</span>
                      : <span className={`font-semibold ${low ? "text-amber-400" : "text-pay"}`}>{p.stockQty}{low ? " · low" : ""}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/products/${p.slug}`} className="text-sm font-bold text-volt hover:underline">Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
