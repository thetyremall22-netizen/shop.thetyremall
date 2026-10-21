import Link from "next/link";
import { TestBadge } from "@/components/admin/TestFlag";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listOrders, orderStatusCounts, orderAttributions, STATUS_LABEL, STATUS_BADGE } from "@/lib/orders";
import { classifyOrigin } from "@/lib/attribution";
import { OriginBadge } from "@/components/admin/OriginBadge";
import { AdminSearch } from "@/components/admin/AdminSearch";

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

export const instant = false;

const STATUS_TABS = ["", "pending", "processing", "on-hold", "completed", "cancelled", "refunded", "partially_refunded", "failed"];

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
  const q = (sp.q ?? "").trim();
  const [{ orders, total, perPage }, counts] = await Promise.all([
    listOrders({ page, perPage: 25, status, test, q }),
    orderStatusCounts({ test }),
  ]);
  const attr = await orderAttributions(orders.map((o) => o.id));
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const qs = (next: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (view) p.set("view", view);
    if (q) p.set("q", q);
    for (const [k, val] of Object.entries(next)) { if (val === undefined || val === "") p.delete(k); else p.set(k, String(val)); }
    const s = p.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Orders <span className="text-base text-muted">({total.toLocaleString()}{q ? " matching" : ""})</span></h1>
      <p className="mt-1 text-sm text-muted">Open any order to edit the customer, address, items, prices and status, email the invoice, and see its full history.</p>

      <AdminSearch className="mt-4 max-w-xl" placeholder="Search order no., name, email, phone, address, product, part no.…" />

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_TABS.filter((v) => v === "" || counts[v] || status === v).map((v) => {
          const active = (status ?? "") === v;
          return (
            <Link key={v || "all"} href={qs({ status: v || undefined, page: undefined })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {v ? STATUS_LABEL[v] ?? v : "All statuses"} <span className="opacity-70">({v ? counts[v] ?? 0 : allCount})</span>
            </Link>
          );
        })}
      </div>

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
        <p className="mt-5 text-sm text-muted">{q || status ? "No orders match." : "No orders yet. They’ll appear here the moment a customer pays."}</p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Origin</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-4 py-2.5 font-semibold">
                      <Link href={`/admin/orders/${o.id}`} className="whitespace-nowrap text-volt hover:underline">{o.reference}</Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <TestBadge test={o.test} className="!ml-0" />
                        {o.totals.total === 0 && <span className="badge badge-muted">free</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-fg">{o.customer.firstName} {o.customer.lastName}</div>
                      <div className="text-xs text-muted">{o.customer.email}</div>
                      <div className="text-xs text-muted">{o.customer.phone}{o.delivery.address?.city ? ` · ${o.delivery.address.city}` : o.delivery.method === "fitment" ? " · fitment" : ""}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{o.items.reduce((n, i) => n + i.qty, 0)}</td>
                    <td className="px-4 py-2.5"><span className={`badge ${STATUS_BADGE[o.status] ?? "badge-muted"}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                    <td className="px-4 py-2.5">{attr[o.id] ? <OriginBadge origin={classifyOrigin(attr[o.id])} /> : <span className="text-xs text-faint">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{zar(o.totals.total)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{new Date(o.createdAt).toLocaleDateString("en-ZA")}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/orders/${o.id}`} className="inline-flex h-7 items-center whitespace-nowrap rounded-md border border-volt/60 px-2 text-[11px] font-bold text-volt hover:bg-volt/10">Open →</Link>
                    </td>
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
