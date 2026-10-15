import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { getAbandoned, type AbandonedItem } from "@/lib/abandoned";
import { formatPrice } from "@/lib/format";
import { Close } from "@/components/icons";

export const instant = false;

const str = (v: unknown) => (v == null ? "" : String(v));
const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};

export default async function AbandonedCartDetail({ params }: { params: Promise<{ email: string }> }) {
  await requireAdmin();
  const { email: emailParam } = await params;
  const email = decodeURIComponent(emailParam);
  const c = await getAbandoned(email);
  if (!c) notFound();

  const items: AbandonedItem[] = (() => { try { return JSON.parse(str(c.items) || "[]"); } catch { return []; } })();
  const total = Number(c.total) || 0;
  const status = Number(c.recovered) ? "Recovered" : Number(c.emailed_at) ? "Reminder sent" : "Pending";

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/leads?tab=carts" className="text-sm font-bold text-volt hover:underline">← Leads &amp; Enquiries</Link>
          <h1 className="mt-2 font-display text-2xl leading-tight break-all">{email}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="badge badge-volt">Abandoned cart</span>
            <span className={`badge ${status === "Recovered" ? "badge-pay" : status === "Pending" ? "badge-warn" : "badge-muted"}`}>{status}</span>
            <span>Updated {when(c.updated_at)}</span>
          </div>
        </div>
        <Link href="/admin/leads?tab=carts" aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="card p-5">
          <h2 className="font-display text-lg">Cart ({items.length} item{items.length === 1 ? "" : "s"})</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2">{it.name}{it.qty > 1 ? ` × ${it.qty}` : ""}</td>
                  <td className="py-2 text-right whitespace-nowrap">{formatPrice((it.price || 0) * (it.qty || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold"><span>Total</span><span>{formatPrice(total)}</span></div>
          {str(c.phone) && <p className="mt-3 text-sm text-muted">Phone: {str(c.phone)}</p>}
        </div>

        <div className="card p-5">
          <h2 className="font-display text-lg">Email this customer</h2>
          <div className="mt-3">
            <ComposeEmailForm
              initialTo={email}
              initialSubject="You left tyres in your cart — The Tyre Mall"
              initialMessage={`Hi,\n\nYou left some great items in your cart with The Tyre Mall${total ? ` (total ${formatPrice(total)})` : ""}. They're still available — reply here or call 078 0088 788 and we'll help you check out. Free delivery on 2 or more tyres, nationwide.`}
            />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
