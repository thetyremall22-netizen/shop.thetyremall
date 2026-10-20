import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer-page";
import { getOrderForEmail, STATUS_LABEL, STATUS_BADGE } from "@/lib/orders";
import { getInvoice } from "@/lib/invoices";
import { supportForOrder, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";
import { formatPrice } from "@/lib/format";
import { AccountFrame } from "@/components/account/AccountNav";

export const instant = false;

const PAYMENT: Record<string, string> = { payfast: "PayFast (card / instant EFT)", happypay: "HappyPay (pay later)", coupon: "Coupon (nothing to pay)" };
const date = (iso: string) => new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CLOSED = ["cancelled", "refunded", "failed"];

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-3 ${strong ? "border-t border-line pt-2 font-bold text-fg" : "text-muted"}`}><span>{k}</span><span className={strong ? "" : "text-fg"}>{v}</span></div>;
}

export default async function MyOrder({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const c = await requireCustomer(`/account/orders/${ref}`);
  const o = await getOrderForEmail(decodeURIComponent(ref), c.email);
  if (!o) notFound();
  const [inv, requests] = await Promise.all([getInvoice(o.id), supportForOrder(o.reference)]);
  const mine = requests.filter((r) => r.customerId === c.id);
  // Older orders may only have stored the grand total.
  const n = (v: unknown) => Number(v) || 0;
  const t = o.totals;
  const subtotal = n(t.subtotal) || o.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const a = o.delivery.address;

  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <Link href="/account/orders" className="text-sm font-semibold text-muted hover:text-volt">← My orders</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Order {o.reference}</h1>
        <span className={`badge ${STATUS_BADGE[o.status] ?? "badge-muted"}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Placed {date(o.createdAt)}{inv ? ` · Tax invoice ${inv.number}` : ""}</p>

      <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4 text-sm">
        <b className="text-fg">Need to change something?</b>{" "}
        <span className="text-muted">Orders can&apos;t be edited online once they&apos;re placed. Send us a request and our team will help you change the delivery address, add more items or cancel.</span>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/account/support/new?order=${o.reference}`} className="btn btn-volt h-10 px-4 text-sm">Request a change</Link>
          <Link href={`/account/support/new?order=${o.reference}&topic=add_items`} className="btn btn-ghost h-10 px-4 text-sm">Add more items</Link>
          {!CLOSED.includes(o.status) && <Link href={`/account/support/new?order=${o.reference}&topic=cancel`} className="btn btn-ghost h-10 px-4 text-sm text-sale">Request a cancellation</Link>}
        </div>
      </div>

      {mine.length > 0 && (
        <div className="mt-4 space-y-2">
          {mine.map((r) => (
            <Link key={r.id} href={`/account/support/${r.ref}`} className="card flex flex-wrap items-center gap-3 p-3 text-sm hover:border-volt">
              <b className="text-fg">{r.ref}</b><span className="text-muted">{TOPIC_LABEL[r.topic]}</span>
              <span className={`badge ${SUPPORT_STATUS_BADGE[r.status]}`}>{SUPPORT_STATUS_LABEL[r.status]}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card p-5">
          <h2 className="font-display text-xl">Items</h2>
          <ul className="mt-3 divide-y divide-line">
            {o.items.map((i, n) => (
              <li key={`${i.slug}-${n}`} className="flex gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${i.slug}`} className="font-semibold text-fg hover:text-volt">{i.name}</Link>
                  <div className="text-xs text-muted">{i.sku ? `Part no. ${i.sku} · ` : ""}{formatPrice(i.price)} each
                    {i.roadHazard ? " · Road hazard cover" : ""}{i.alignment ? " · Wheel alignment" : ""}{i.balanceQty ? ` · Balancing ×${i.balanceQty}` : ""}</div>
                </div>
                <div className="shrink-0 text-right"><div className="text-muted">×{i.qty}</div><div className="font-semibold text-fg">{formatPrice(i.price * i.qty)}</div></div>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-6">
          <section className="card space-y-1.5 p-5 text-sm">
            <h2 className="mb-2 font-display text-xl">Totals</h2>
            <Row k="Subtotal" v={formatPrice(subtotal)} />
            {n(t.setDiscount) > 0 && <Row k="Set discount" v={`−${formatPrice(n(t.setDiscount))}`} />}
            {n(t.hazardTotal) > 0 && <Row k="Road hazard cover" v={formatPrice(n(t.hazardTotal))} />}
            {n(t.alignmentTotal) > 0 && <Row k="Alignment" v={formatPrice(n(t.alignmentTotal))} />}
            {n(t.balanceTotal) > 0 && <Row k="Balancing" v={formatPrice(n(t.balanceTotal))} />}
            {t.delivery !== undefined && <Row k="Delivery" v={t.freeDelivery || n(t.delivery) === 0 ? "Free" : formatPrice(n(t.delivery))} />}
            {n(t.couponDiscount) > 0 && <Row k={`Coupon ${t.couponCode ?? ""}`} v={`−${formatPrice(n(t.couponDiscount))}`} />}
            <Row k="Total" v={formatPrice(n(t.total))} strong />
            <p className="pt-2 text-xs text-muted">Paid with {PAYMENT[o.paymentMethod] ?? o.paymentMethod}</p>
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-2 font-display text-xl">{o.delivery.method === "fitment" ? "Fitment" : "Delivery"}</h2>
            {o.delivery.method === "fitment"
              ? <p className="text-fg">{o.delivery.fitmentStore}{o.delivery.fitmentDate ? <><br /><span className="text-muted">{o.delivery.fitmentDate}</span></> : null}</p>
              : a ? <p className="text-fg">{a.street}<br />{a.suburb}, {a.city}<br />{a.province} {a.postalCode}</p> : <p className="text-muted">—</p>}
            <h3 className="mt-4 text-xs font-semibold uppercase text-muted">Contact</h3>
            <p className="text-fg">{o.customer.firstName} {o.customer.lastName}<br />{o.customer.phone}</p>
          </section>
        </div>
      </div>
    </AccountFrame>
  );
}
