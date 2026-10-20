import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { TestBadge, TestToggle } from "@/components/admin/TestFlag";
import { SupportActions } from "@/components/admin/SupportActions";
import { listAudit } from "@/lib/audit";
import { orderIdsByReference } from "@/lib/orders";
import { getCustomerByEmail } from "@/lib/customers";
import { getSupportRequest, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";

export const instant = false;

const when = (ms: number) => new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminSupportRequest({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("orders.view");
  const id = Number((await params).id);
  const r = Number.isFinite(id) ? await getSupportRequest(id) : null;
  if (!r) notFound();
  const [orderIds, audit, client] = await Promise.all([orderIdsByReference(r.orderRefs), listAudit("support", String(id)), getCustomerByEmail(r.email)]);

  return (
    <AdminShell>
      <Link href="/admin/support" className="text-sm font-semibold text-muted hover:text-volt">← Support</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">{r.ref}</h1>
        <span className={`badge ${SUPPORT_STATUS_BADGE[r.status]}`}>{SUPPORT_STATUS_LABEL[r.status]}</span>
        <TestBadge test={r.test} />
      </div>
      <p className={`mt-1 text-sm font-semibold ${r.topic === "cancel" ? "text-sale" : "text-fg"}`}>{TOPIC_LABEL[r.topic]}</p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            {r.messages?.map((m) => (
              <div key={m.id} className={`max-w-[92%] rounded-xl border p-4 text-sm ${m.author === "staff" ? "ml-auto border-volt/40 bg-volt/5" : "border-line bg-surface-2"}`}>
                <div className="mb-1 text-xs font-semibold text-muted">{m.author === "staff" ? `${m.authorName} (staff)` : `${m.authorName} (client)`} · {when(m.createdAt)}</div>
                <div className="whitespace-pre-wrap text-fg">{m.body}</div>
              </div>
            ))}
          </div>
          <SupportActions id={r.id} status={r.status} statuses={Object.entries(SUPPORT_STATUS_LABEL)} canEdit={can(me.role, "orders.edit")} clientEmail={r.email} />
        </div>
        <div className="space-y-6">
          <div className="card space-y-2 p-5 text-sm">
            <h2 className="font-display text-lg">Client</h2>
            <div className="font-semibold text-fg">{r.name}</div>
            <a href={`mailto:${r.email}`} className="block text-volt hover:underline">{r.email}</a>
            {r.phone && <a href={`tel:${r.phone}`} className="block text-fg">{r.phone}</a>}
            {client && <p className="text-xs text-muted">Account since {new Date(client.createdAt).toLocaleDateString("en-ZA")}</p>}
            <Link href={`/admin/orders?q=${encodeURIComponent(r.email)}`} className="block text-xs font-semibold text-volt hover:underline">All orders for this email →</Link>
          </div>
          <div className="card space-y-2 p-5 text-sm">
            <h2 className="font-display text-lg">Order(s)</h2>
            {r.orderRefs.length === 0 ? <p className="text-muted">No order linked.</p> : r.orderRefs.map((ref) => (
              orderIds[ref]
                ? <Link key={ref} href={`/admin/orders/${encodeURIComponent(orderIds[ref])}`} className="block font-semibold text-volt hover:underline">{ref} → open / edit order</Link>
                : <span key={ref} className="block text-fg">{ref}</span>
            ))}
            {r.topic === "cancel" && <p className="rounded-lg border border-sale/40 bg-sale/10 p-2 text-xs text-fg">To cancel: open the order, change its status to Cancelled (and refund if paid), then reply here to confirm with the client.</p>}
          </div>
          <div className="card p-5 text-sm"><TestToggle kind="support" id={r.id} test={r.test} /></div>
          <AuditHistory entries={audit} />
        </div>
      </div>
    </AdminShell>
  );
}
