import Link from "next/link";
import { TestBadge, TestToggle } from "@/components/admin/TestFlag";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { RefundForm } from "@/components/admin/RefundForm";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { OrderCustomerEditor, OrderItemsEditor, OrderStatusEditor, OrderEmailActions, OrderNoteForm } from "@/components/admin/OrderEditors";
import { getOrder, STATUS_LABEL, STATUS_BADGE } from "@/lib/orders";
import { listAudit } from "@/lib/audit";
import { getInvoice } from "@/lib/invoices";
import { supportForOrder, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";
import { listEmailsForOrder, EMAIL_TYPE_LABELS } from "@/lib/email-log";
import { getProduct } from "@/lib/catalogue";
import { Close } from "@/components/icons";

export const instant = false;

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
const when = (d: string | number) => new Date(d).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();
  const [orderEmails, history, invoice, support] = await Promise.all([listEmailsForOrder(o.reference), listAudit("order", o.id), getInvoice(o.id), supportForOrder(o.reference)]);
  // Show part numbers for orders placed before SKUs were saved on the order.
  const items = await Promise.all(o.items.map(async (i) => (i.sku ? i : { ...i, sku: (await getProduct(i.slug).catch(() => undefined))?.sku || undefined })));
  const canEdit = can(me.role, "orders.edit");
  const t = o.totals;

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm font-bold text-volt hover:underline">← Orders</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl">{o.reference}</h1>
            <span className={`badge ${STATUS_BADGE[o.status] ?? "badge-muted"}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
            <TestBadge test={o.test} />
            {canEdit && <TestToggle kind="order" id={o.id} test={!!o.test} />}
            {o.totals.total === 0 && <span className="badge badge-muted">free</span>}
          </div>
          <div className="mt-1 text-sm text-muted">{invoice ? <>Tax invoice <b className="text-fg">{invoice.number}</b> ({when(invoice.issuedAt)}) · </> : "No tax invoice issued yet · "}Placed {when(o.createdAt)} · {o.paymentMethod}{o.pfPaymentId ? ` (PF ${o.pfPaymentId})` : ""} · Last updated {when(o.updatedAt)}</div>
        </div>
        <Link href="/admin/orders" aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      {support.length > 0 && (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${support.some((r) => r.topic === "cancel" && !["resolved", "closed"].includes(r.status)) ? "border-sale/50 bg-sale/10" : "border-line"}`}>
          <b className="text-fg">Support requests about this order</b>
          <div className="mt-2 space-y-1">
            {support.map((r) => (
              <Link key={r.id} href={`/admin/support/${r.id}`} className="flex flex-wrap items-center gap-2 hover:text-volt">
                <span className="font-bold text-volt">{r.ref}</span>
                <span className={r.topic === "cancel" ? "font-semibold text-sale" : "text-fg"}>{TOPIC_LABEL[r.topic]}</span>
                <span className={`badge ${SUPPORT_STATUS_BADGE[r.status]}`}>{SUPPORT_STATUS_LABEL[r.status]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 card p-4">
        <OrderEmailActions id={o.id} customerEmail={o.customer.email} canSend={can(me.role, "emails.send")} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <OrderItemsEditor id={o.id} items={items} totals={t} canEdit={canEdit} />

          <div className="card p-5">
            <h2 className="font-display text-lg">Order status</h2>
            <div className="mt-3"><OrderStatusEditor id={o.id} current={o.status} canEdit={canEdit} /></div>
          </div>

          {(() => {
            const refunded = o.refundedAmount ?? 0;
            const remaining = t.total - refunded;
            const canRefund = canEdit && ["processing", "completed", "partially_refunded"].includes(o.status) && remaining > 0;
            if (refunded === 0 && !canRefund) return null;
            return (
              <div className="card p-5">
                <h2 className="font-display text-lg">Refund</h2>
                {refunded > 0 && <p className="mt-1 text-sm text-muted">Refunded so far: <span className="font-semibold text-fg">{zar(refunded)}</span> of {zar(t.total)}{remaining > 0 ? ` · ${zar(remaining)} remaining` : " · fully refunded"}.</p>}
                {canRefund
                  ? <div className="mt-3"><RefundForm id={o.id} maxRefundCents={remaining} paymentMethod={o.paymentMethod} /></div>
                  : <p className="mt-1 text-sm text-muted">This order is fully refunded.</p>}
              </div>
            );
          })()}

          <div className="card p-5">
            <h2 className="font-display text-lg">Emails for this order <span className="text-sm text-muted">({orderEmails.length})</span></h2>
            {orderEmails.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No emails logged for this order yet. Every email about this order (confirmation, invoice, status changes, and messages you write below) is recorded here.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <tbody>
                    {orderEmails.map((e) => (
                      <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted">{when(e.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/emails/${e.id}`} className="font-semibold text-volt hover:underline">{EMAIL_TYPE_LABELS[e.type] ?? e.type}</Link>
                          {e.resend && <span className="ml-1.5 badge badge-muted">resend</span>}
                          <div className="text-xs text-muted">{e.subject}</div>
                          <div className="text-xs text-muted">To {e.toAddr}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`badge ${e.status === "sent" ? "badge-pay" : e.status === "failed" ? "badge-sale" : "badge-muted"}`}>{e.status === "skipped" ? "not sent" : e.status}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap"><Link href={`/admin/emails/${e.id}`} className="text-sm font-semibold text-volt hover:underline">View / resend →</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {can(me.role, "emails.send") && (
            <div className="card p-5">
              <h2 className="font-display text-lg">Write an email to the customer</h2>
              <p className="mt-1 text-sm text-muted">Send {o.customer.firstName} a message about this order. CC&apos;d to the shop and logged in this order&apos;s emails.</p>
              <div className="mt-4 max-w-2xl">
                <ComposeEmailForm
                  initialTo={o.customer.email}
                  initialSubject={`The Tyre Mall — about your order ${o.reference}`}
                  initialMessage={`Hi ${o.customer.firstName},\n\nRegarding your order ${o.reference}: `}
                  orderRef={o.reference}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <OrderCustomerEditor id={o.id} customer={o.customer} delivery={o.delivery} canEdit={canEdit} />
          {canEdit && (
            <div className="card p-5">
              <h2 className="font-display text-lg">Add a note</h2>
              <div className="mt-3"><OrderNoteForm id={o.id} /></div>
            </div>
          )}
          <AuditHistory title="Order history" entries={history} empty={`Order placed ${when(o.createdAt)}. No changes yet.`} />
        </div>
      </div>
    </AdminShell>
  );
}
