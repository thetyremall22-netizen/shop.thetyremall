import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { TestBadge } from "@/components/admin/TestFlag";
import { JourneyOutcomeBadge } from "@/components/admin/JourneyOutcomeBadge";
import { listJourneys } from "@/lib/tyrone-journey";

export const instant = false;

const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "—");
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

const FILTERS = [
  { v: "", label: "All" },
  { v: "bought", label: "✅ Bought" },
  { v: "cart", label: "🛒 Cart / unpaid order" },
  { v: "whatsapp", label: "💬 WhatsApp" },
  { v: "none", label: "No sale yet" },
];

export default async function TyroneConversations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("leads.view");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const f = FILTERS.some((x) => x.v === sp.f) ? sp.f ?? "" : "";
  const all = await listJourneys({ q });
  const rows = all.filter((j) =>
    !f ? true
      : f === "bought" ? j.outcome.kind === "bought"
      : f === "cart" ? ["unpaid_order", "added_to_cart"].includes(j.outcome.kind)
      : f === "whatsapp" ? j.outcome.kind === "whatsapp"
      : !["bought"].includes(j.outcome.kind));
  const bought = all.filter((j) => j.outcome.kind === "bought");
  const sales = bought.reduce((n, j) => n + (j.outcome.total ?? 0), 0);
  const href = (v: string) => { const p = new URLSearchParams(); if (v) p.set("f", v); if (q) p.set("q", q); const s = p.toString(); return s ? `/admin/leads/tyrone?${s}` : "/admin/leads/tyrone"; };

  return (
    <AdminShell>
      <Link href="/admin/leads" className="text-sm font-semibold text-muted hover:text-volt">← Leads &amp; Enquiries</Link>
      <h1 className="mt-2 font-display text-3xl">Tyrone conversations</h1>
      <p className="mt-1 text-sm text-muted">Everyone who chatted to Tyrone, with their contact details, what they asked, what they clicked and visited afterwards, and whether it led to a sale. A sale counts if the order was placed after chatting (same browser), or by the same email or mobile within 14 days.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Conversations</div><div className="font-display text-3xl">{all.length}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Led to a sale</div><div className="font-display text-3xl">{bought.length}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Sales value</div><div className="font-display text-3xl">{zar(sales)}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Conversion</div><div className="font-display text-3xl">{all.length ? Math.round((bought.length / all.length) * 100) : 0}%</div></div>
      </div>

      <AdminSearch className="mt-4 max-w-xl" placeholder="Search name, email, phone, question…" />
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link key={x.v} href={href(x.v)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${f === x.v ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>{x.label}</Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2.5">Last activity</th><th className="px-3 py-2.5">Customer</th><th className="min-w-[200px] px-3 py-2.5">First question</th><th className="px-3 py-2.5">Journey</th><th className="px-3 py-2.5">Outcome</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">{q || f ? "No matches." : "No Tyrone conversations yet. They appear here from the first question."}</td></tr>
            ) : rows.map((j) => (
              <tr key={j.sid} className="border-b border-line align-top last:border-0 hover:bg-surface">
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{when(j.lastAt)}</td>
                <td className="px-3 py-2.5">
                  {j.name || j.email ? <><Link href={`/admin/leads/tyrone/${j.sid}`} className="font-semibold text-fg hover:text-volt">{j.name || "—"}</Link><TestBadge test={j.test} /><div className="text-xs text-muted">{j.email}</div><div className="text-xs text-muted">{j.phone}</div></>
                    : <span className="text-xs text-muted">Left before sharing details<TestBadge test={j.test} /></span>}
                </td>
                <td className="px-3 py-2.5 text-fg">{cut(j.firstQuestion || "—", 70)}</td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  <div>{j.questions} question{j.questions === 1 ? "" : "s"}</div>
                  <div>{j.productClicks} product click{j.productClicks === 1 ? "" : "s"}</div>
                  <div>{j.pageViews} page{j.pageViews === 1 ? "" : "s"}{j.addToCart ? ` · ${j.addToCart} add to cart` : ""}</div>
                </td>
                <td className="px-3 py-2.5">
                  <JourneyOutcomeBadge outcome={j.outcome} />{j.outcome.total ? <div className="mt-1 text-xs font-semibold text-fg">{zar(j.outcome.total)}</div> : null}
                  <div className="mt-1.5"><Link href={`/admin/leads/tyrone/${j.sid}`} className="text-xs font-bold text-volt hover:underline">Open →</Link></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
