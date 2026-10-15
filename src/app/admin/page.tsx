import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { dashboardStats } from "@/lib/db/queries";
import { listOrders } from "@/lib/orders";
import { SyncWooButton } from "@/components/admin/SyncWooButton";

export const instant = false;

export default async function AdminDashboard() {
  await requireAdmin();
  const stats = await dashboardStats();
  const { orders, total: orderTotal } = await listOrders({ perPage: 6 });

  const cards = [
    { label: "Products", value: stats.total, href: "/admin/products" },
    { label: "In stock", value: stats.inStock, href: "/admin/products" },
    { label: "Low stock", value: stats.low, href: "/admin/products?filter=low", warn: stats.low > 0 },
    { label: "Out of stock", value: stats.out, href: "/admin/products?filter=out" },
    { label: "On sale", value: stats.onSale, href: "/admin/products?filter=sale" },
    { label: "Orders", value: orderTotal, href: "/admin/orders" },
  ];

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Dashboard</h1>
      <div className="mt-3"><SyncWooButton /></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`card glow-hover p-5 ${c.warn ? "ring-1 ring-sale/50" : ""}`}>
            <div className={`font-display text-4xl ${c.warn ? "text-sale" : "text-volt"}`}>{c.value.toLocaleString()}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{c.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 font-display text-xl">Recent orders</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold text-fg">
                    {o.reference}
                    {o.test && <span className="ml-1.5 badge badge-warn">test</span>}
                    {o.totals.total === 0 && <span className="ml-1.5 badge badge-muted">free</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{o.customer.firstName} {o.customer.lastName}</td>
                  <td className="px-4 py-2.5"><span className="badge badge-pay">{o.status}</span></td>
                  <td className="px-4 py-2.5 text-right font-semibold">R{(o.totals.total / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link href="/admin/orders" className="mt-3 inline-block text-sm font-bold text-volt hover:underline">All orders →</Link>
    </AdminShell>
  );
}
