import Link from "next/link";
import { requireCustomer } from "@/lib/customer-page";
import { listOrdersForEmail, STATUS_LABEL, STATUS_BADGE } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { AccountFrame } from "@/components/account/AccountNav";

export const instant = false;
export const metadata = { title: "My orders" };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export default async function MyOrders() {
  const c = await requireCustomer("/account/orders");
  const orders = await listOrdersForEmail(c.email);
  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <h1 className="font-display text-3xl sm:text-4xl">My orders</h1>
      <p className="mt-1 text-sm text-muted">Every order placed with {c.email}. Orders can&apos;t be changed online once placed. Open an order and choose “Request a change” if you need anything.</p>
      {orders.length === 0 ? (
        <div className="card mt-6 p-5 text-sm text-muted">No orders yet. <Link href="/shop" className="font-bold text-volt hover:underline">Start shopping →</Link></div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Order</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Items</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5" />
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-bold text-fg">{o.reference}</td>
                  <td className="px-4 py-3 text-muted">{date(o.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{o.items.reduce((n, i) => n + i.qty, 0)}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[o.status] ?? "badge-muted"}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-fg">{formatPrice(o.totals.total)}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/account/orders/${o.reference}`} className="font-bold text-volt hover:underline">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountFrame>
  );
}
