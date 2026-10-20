import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { TestBadge } from "@/components/admin/TestFlag";
import { listSupport, supportCounts, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";
import { listCustomers } from "@/lib/customers";

export const instant = false;

const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—");
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

const TABS = [
  { v: "active", label: "Needs attention" },
  { v: "open", label: "New" },
  { v: "in_progress", label: "In progress" },
  { v: "waiting", label: "Waiting for client" },
  { v: "resolved", label: "Resolved" },
  { v: "closed", label: "Closed" },
  { v: "all", label: "All requests" },
  { v: "clients", label: "Registered clients" },
];

export default async function AdminSupport({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("orders.view");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.v === sp.tab) ? sp.tab! : "active";
  const q = (sp.q ?? "").trim();
  const [counts, rows, clients] = await Promise.all([
    supportCounts(),
    tab === "clients" ? Promise.resolve([]) : listSupport({ status: tab === "all" ? undefined : tab, q }),
    tab === "clients" ? listCustomers({ q }) : Promise.resolve([]),
  ]);
  const href = (v: string) => {
    const p = new URLSearchParams();
    if (v !== "active") p.set("tab", v);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/support?${s}` : "/admin/support";
  };
  const count = (v: string) => (v === "clients" ? null : v === "all" ? counts.all : counts[v] ?? 0);

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Support</h1>
      <p className="mt-1 text-sm text-muted">Requests from clients signed in to the client zone: order changes, extra items, cancellations and questions. Clients can&apos;t change an order themselves once it&apos;s placed, so it comes here. Replies you send are emailed to the client and shown in their account.</p>

      <AdminSearch className="mt-4 max-w-xl" placeholder={tab === "clients" ? "Search client name, email, phone…" : "Search SUP number, order number, client, message…"} />

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = tab === t.v;
          const n = count(t.v);
          return (
            <Link key={t.v} href={href(t.v)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label}{n !== null && <span className={on ? " opacity-80" : " opacity-70"}> ({n})</span>}
            </Link>
          );
        })}
      </div>

      {tab !== "clients" ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5">Request</th><th className="px-3 py-2.5">Updated</th><th className="px-3 py-2.5">Client</th><th className="px-3 py-2.5">Topic</th><th className="px-3 py-2.5">Order(s)</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Latest message</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">{q ? "No matches." : "Nothing here."}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0 hover:bg-surface">
                  <td className="px-3 py-2.5 whitespace-nowrap"><Link href={`/admin/support/${r.id}`} className="font-bold text-volt hover:underline">{r.ref}</Link><TestBadge test={r.test} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted">{when(r.updatedAt)}</td>
                  <td className="px-3 py-2.5"><div className="font-semibold text-fg">{r.name}</div><div className="text-xs text-muted">{r.email}</div></td>
                  <td className="px-3 py-2.5">{r.topic === "cancel" ? <span className="font-semibold text-sale">{TOPIC_LABEL[r.topic]}</span> : TOPIC_LABEL[r.topic]}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.orderRefs.join(", ") || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`badge ${SUPPORT_STATUS_BADGE[r.status]}`}>{SUPPORT_STATUS_LABEL[r.status]}</span>
                    {r.lastBy === "client" && r.status !== "open" && !["closed"].includes(r.status) && <div className="mt-1 text-[11px] font-bold text-amber-400">Client replied</div>}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{cut(r.preview, 90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">Clients who created an account in the client zone. A client only sees orders placed with their confirmed email address.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Client</th><th className="px-3 py-2.5">Phone</th><th className="px-3 py-2.5">Joined</th><th className="px-3 py-2.5">Last sign-in</th><th className="px-3 py-2.5">Email confirmed</th><th className="px-3 py-2.5">Orders</th><th className="px-3 py-2.5">Wishlist</th>
              </tr></thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">{q ? "No matches." : "No registered clients yet."}</td></tr>
                ) : clients.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5"><div className="font-semibold text-fg">{c.firstName} {c.lastName}<TestBadge test={c.test} /></div><div className="text-xs text-muted">{c.email}</div></td>
                    <td className="px-3 py-2.5 text-muted">{c.phone}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">{when(c.createdAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted">{c.lastLoginAt ? when(c.lastLoginAt) : "—"}</td>
                    <td className="px-3 py-2.5">{c.verified ? <span className="badge badge-pay">Yes</span> : <span className="badge badge-warn">Not yet</span>}</td>
                    <td className="px-3 py-2.5">{c.orders > 0 ? <Link href={`/admin/orders?q=${encodeURIComponent(c.email)}`} className="font-semibold text-volt hover:underline">{c.orders}</Link> : "0"}</td>
                    <td className="px-3 py-2.5 text-muted">{c.wishlist}{!c.wishlistEmails && <span className="ml-1 text-xs">(emails off)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
