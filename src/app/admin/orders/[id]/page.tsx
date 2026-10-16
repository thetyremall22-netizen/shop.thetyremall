import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { getOrder } from "@/lib/orders";
import { listEmailsForOrder, EMAIL_TYPE_LABELS } from "@/lib/email-log";

export const instant = false;

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();
  const orderEmails = await listEmailsForOrder(o.reference);

  const a = o.delivery.address;
  const t = o.totals;

  return (
    <AdminShell>
      <Link href="/admin/orders" className="text-sm font-bold text-volt hover:underline">← Orders</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{o.reference}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {o.test && <span className="badge badge-warn">test order</span>}
          {o.totals.total === 0 && <span className="badge badge-muted">free</span>}
          <span className="badge badge-pay">{o.status}</span>
        </div>
      </div>
      <div className="mt-1 text-sm text-muted">Placed {new Date(o.createdAt).toLocaleString("en-ZA")} · Paid via {o.paymentMethod}{o.pfPaymentId ? ` (PF ${o.pfPaymentId})` : ""}</div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="card p-5">
          <h2 className="font-display text-lg">Items</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {o.items.map((i) => (
                <tr key={i.slug} className="border-b border-line last:border-0">
                  <td className="py-2">{i.name}{i.qty > 1 ? ` × ${i.qty}` : ""}
                    {(i.alignment || (i.balanceQty ?? 0) > 0 || i.roadHazard) && (
                      <div className="text-xs text-muted">
                        {i.alignment ? "alignment " : ""}{(i.balanceQty ?? 0) > 0 ? `balance×${i.balanceQty} ` : ""}{i.roadHazard ? "road-hazard" : ""}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">{zar(i.price * i.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <Row k="Subtotal" v={zar(t.subtotal)} />
            {t.alignmentTotal > 0 && <Row k="Alignment" v={zar(t.alignmentTotal)} />}
            {t.balanceTotal > 0 && <Row k="Balance & valve" v={zar(t.balanceTotal)} />}
            {t.hazardTotal > 0 && <Row k="Road hazard" v={zar(t.hazardTotal)} />}
            {t.couponDiscount > 0 && <Row k={`Coupon ${t.couponCode ?? ""}`} v={`−${zar(t.couponDiscount)}`} />}
            <Row k="Delivery" v={t.delivery === 0 ? "FREE" : zar(t.delivery)} />
            <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>Total</dt><dd>{zar(t.total)}</dd></div>
          </dl>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-display text-lg">Customer</h2>
            <div className="mt-2 text-sm">
              <div className="font-semibold text-fg">{o.customer.firstName} {o.customer.lastName}</div>
              <div className="text-muted">{o.customer.email}</div>
              <div className="text-muted">{o.customer.phone}</div>
            </div>
            <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{o.delivery.method === "fitment" ? "Fitment" : "Delivery"}</h3>
            <div className="mt-1 text-sm text-fg">
              {o.delivery.method === "fitment"
                ? <>{o.delivery.fitmentStore ?? "Partner centre"}{o.delivery.fitmentDate ? ` · ${o.delivery.fitmentDate}` : ""}</>
                : a ? <>{a.street}, {a.suburb}<br />{a.city}, {a.province} {a.postalCode}</> : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 card p-5">
        <h2 className="font-display text-lg">Update status</h2>
        <div className="mt-3"><OrderStatusForm id={o.id} current={o.status} /></div>
      </div>

      <div className="mt-5 card p-5">
        <h2 className="font-display text-lg">Emails for this order</h2>
        {orderEmails.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No emails logged for this order yet. They&apos;re recorded here as the order&apos;s confirmation, status-change and other emails go out.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <tbody>
                {orderEmails.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted">{new Date(e.createdAt).toLocaleString("en-ZA")}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/emails/${e.id}`} className="font-semibold text-volt hover:underline">{EMAIL_TYPE_LABELS[e.type] ?? e.type}</Link>
                      {e.resend && <span className="ml-1.5 badge badge-muted">resend</span>}
                      <div className="text-xs text-muted">{e.toAddr}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`badge ${e.status === "sent" ? "badge-pay" : e.status === "failed" ? "badge-sale" : "badge-muted"}`}>{e.status === "skipped" ? "not sent" : e.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/admin/emails/${e.id}`} className="text-sm font-semibold text-volt hover:underline">Open / resend →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-5 card p-5">
        <h2 className="font-display text-lg">Email this customer</h2>
        <p className="mt-1 text-sm text-muted">Send {o.customer.firstName} a message about this order. CC&apos;d to the shop and logged above.</p>
        <div className="mt-4 max-w-2xl">
          <ComposeEmailForm
            initialTo={o.customer.email}
            initialSubject={`The Tyre Mall — about your order ${o.reference}`}
            initialMessage={`Hi ${o.customer.firstName},\n\nRegarding your order ${o.reference}: `}
            orderRef={o.reference}
          />
        </div>
      </div>
    </AdminShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>;
}
