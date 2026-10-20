import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { CartsTable } from "@/components/admin/CartRecoveryAdmin";
import { getCart, STATUS_LABEL, SOURCE_LABEL } from "@/lib/cart-recovery";
import { recoveryUrl } from "@/lib/cart-recovery-email";
import { listAudit } from "@/lib/audit";
import { listEmails, EMAIL_TYPE_LABELS } from "@/lib/email-log";
import { Close } from "@/components/icons";

export const instant = false;
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "—");

export default async function CartDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("leads.view");
  const id = Number((await params).id);
  const c = await getCart(id);
  if (!c) notFound();
  const [history, emails] = await Promise.all([
    listAudit("cart", id),
    listEmails({ q: c.email, types: ["abandoned_cart"], perPage: 50 }),
  ]);
  const a = c.address ?? {};
  const row = {
    id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, source: c.source, status: c.status,
    items: c.items.map((i) => ({ name: i.name, qty: i.qty })), total: c.total, emailsSent: c.emailsSent, lastEmailAt: c.lastEmailAt,
    orderRef: c.orderRef, recoveredOrderRef: c.recoveredOrderRef, createdAt: c.createdAt, updatedAt: c.updatedAt,
  };

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/cart-recovery" className="text-sm font-bold text-volt hover:underline">← Abandoned carts</Link>
          <h1 className="mt-2 font-display text-2xl">Cart #{c.id} — {`${c.firstName} ${c.lastName}`.trim() || c.email}</h1>
          <div className="mt-1 text-sm text-muted">{SOURCE_LABEL[c.source]} · {STATUS_LABEL[c.status]} · {c.emailsSent}/3 emails · started {when(c.createdAt)}</div>
        </div>
        <Link href="/admin/cart-recovery" aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-sale hover:text-sale"><Close width={16} height={16} /></Link>
      </div>

      <div className="mt-5"><CartsTable rows={[row]} canAct={can(me.role, "leads.reply")} canDelete={can(me.role, "leads.edit")} /></div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-lg">Customer</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div><dt className="inline text-muted">Name: </dt><dd className="inline text-fg">{`${c.firstName} ${c.lastName}`.trim() || "—"}</dd></div>
            <div><dt className="inline text-muted">Email: </dt><dd className="inline"><a className="text-volt hover:underline" href={`mailto:${c.email}`}>{c.email}</a></dd></div>
            <div><dt className="inline text-muted">Phone: </dt><dd className="inline text-fg">{c.phone ? <a className="text-volt hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : "—"}</dd></div>
            <div><dt className="inline text-muted">Address: </dt><dd className="inline text-fg">{[a.street, a.suburb, a.city, a.province, a.postalCode].filter(Boolean).join(", ") || "—"}</dd></div>
            {c.orderRef && <div><dt className="inline text-muted">Order: </dt><dd className="inline text-fg">{c.orderRef}</dd></div>}
            {c.recoveredOrderRef && <div><dt className="inline text-muted">Paid order: </dt><dd className="inline text-fg">{c.recoveredOrderRef}{c.status === "recovered" ? ` · recovered ${zar(c.recoveredValue)}` : ""}</dd></div>}
          </dl>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Items</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {c.items.map((i, k) => <li key={k} className="flex justify-between gap-3"><Link href={`/product/${i.slug}`} target="_blank" className="text-fg hover:text-volt">{i.qty}× {i.name}</Link><span className="text-muted">{zar(i.price * i.qty)}</span></li>)}
            <li className="flex justify-between border-t border-line pt-1 font-bold"><span>Total</span><span>{zar(c.total)}</span></li>
          </ul>
          <p className="mt-4 break-all text-xs text-muted">Recovery link (restores this cart): <span className="text-fg">{recoveryUrl(c)}</span></p>
        </div>
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-display text-lg">Recovery emails sent</h2>
            {emails.rows.length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {emails.rows.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <Link href={`/admin/emails/${e.id}`} className="truncate text-volt hover:underline">{e.subject}</Link>
                    <span className="shrink-0 text-xs text-muted">{EMAIL_TYPE_LABELS[e.type] ? "" : e.type}{when(e.createdAt)} · {e.status === "skipped" ? "not sent" : e.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AuditHistory title="History" entries={history} empty={`Captured ${when(c.createdAt)}. No staff actions yet.`} />
        </div>
      </div>
    </AdminShell>
  );
}
