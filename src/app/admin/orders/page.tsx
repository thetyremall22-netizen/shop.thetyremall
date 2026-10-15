import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listOrders } from "@/lib/orders";

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

export const instant = false;

const VIEW_FILTERS = [
  { v: "", label: "All" },
  { v: "live", label: "Live" },
  { v: "test", label: "Test" },
];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status;
  const view = sp.view === "live" || sp.view === "test" ? sp.view : undefined;
  const test = view === "test" ? true : view === "live" ? false : undefined;
  const { orders, total, perPage } = await listOrders({ page, perPage: 25, status, test });
  const pages = Math.max(1, Math.ceil(total / perPage));
  const qs = (next: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (view) p.set("view", view);
    for (const [k, val] of Object.entries(next)) { if (val === undefined || val === "") p.delete(k); else p.set(k, String(val)); }
    const s = p.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Orders <span className="text-base text-muted">({total.toLocaleString()})</span></h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {VIEW_FILTERS.map((f) => {
          const active = (view ?? "") === f.v;
          return (
            <Link key={f.label} href={qs({ view: f.v || undefined, page: undefined })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {f.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <p className="mt-5 text-sm text-muted">No orders yet. They&apos;ll appear here the moment a customer pays.</p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-4 py-2.5 font-semibold">
                      <Link href={`/admin/orders/${o.id}`} className="text-volt hover:underline">{o.reference}</Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {o.test && <span className="badge badge-warn">test</span>}
                        {o.totals.total === 0 && <span className="badge badge-muted">free</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-fg">{o.customer.firstName} {o.customer.lastName}</div>
                      <div className="text-xs text-muted">{o.customer.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{o.items.reduce((n, i) => n + i.qty, 0)}</td>
                    <td className="px-4 py-2.5"><span className="badge badge-pay">{o.status}</span></td>
                    <td className="px-4 py-2.5 text-right font-semibold">{zar(o.totals.total)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{new Date(o.createdAt).toLocaleDateString("en-ZA")}</td>
                  </tr>
                ))}
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
        </>
      )}
    </AdminShell>
  );
}
