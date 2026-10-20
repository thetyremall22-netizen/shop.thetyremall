import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listLeads, leadCounts } from "@/lib/contacts";
import { listEnquiries } from "@/lib/enquiries";
import { listAbandoned } from "@/lib/abandoned";
import { formatPrice } from "@/lib/format";

export const instant = false;

const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};
function str(v: unknown): string { return v == null ? "" : String(v); }
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n) + "…" : s; }

// One tab per website form (matched on the lead's `source`), plus abandoned
// carts and call taps.
const SOURCE_TABS = [
  { v: "contact", label: "Contact form" },
  { v: "whatsapp-quote", label: "WhatsApp quote" },
  { v: "whatsapp-enquiry", label: "Product enquiry" },
  { v: "whatsapp-chat", label: "WhatsApp chat" },
  { v: "tyrone", label: "Tyrone chat" },
] as const;
type TabV = (typeof SOURCE_TABS)[number]["v"] | "carts" | "calls" | "questions";
const isSourceTab = (t: string): boolean => SOURCE_TABS.some((s) => s.v === t);

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const valid: string[] = [...SOURCE_TABS.map((t) => t.v), "carts", "calls", "questions"];
  const tab: TabV = valid.includes(sp.tab ?? "") ? (sp.tab as TabV) : "contact";

  const [counts, carts, calls] = await Promise.all([leadCounts(), listAbandoned(200), listEnquiries(200)]);
  const callRows = calls.filter((e) => str(e.type) === "call");
  // Tyrone questions and WhatsApp taps from before the "Before we chat" step:
  // no contact details, but kept visible so nothing is lost.
  const questionRows = calls.filter((e) => str(e.type) !== "call");
  const leadRows = isSourceTab(tab) ? await listLeads({ source: tab, limit: 300 }) : [];

  const tabs: { v: TabV; label: string; count: number }[] = [
    ...SOURCE_TABS.map((t) => ({ v: t.v as TabV, label: t.label, count: counts[t.v] ?? 0 })),
    { v: "carts", label: "Abandoned carts", count: carts.length },
    { v: "calls", label: "Call taps", count: callRows.length },
    { v: "questions", label: "Chat questions & older taps", count: questionRows.length },
  ];

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Leads &amp; Enquiries</h1>
      <p className="mt-1 text-sm text-muted">Every website form lands here under its own tab, plus call taps and abandoned checkouts. Follow these up.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.v;
          return (
            <Link key={t.v} href={t.v === "contact" ? "/admin/leads" : `/admin/leads?tab=${t.v}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label} <span className={active ? "opacity-80" : "opacity-70"}>({t.count})</span>
            </Link>
          );
        })}
      </div>

      {isSourceTab(tab) && (
        <Table
          empty="Nothing captured here yet."
          head={["When", "Name", "Phone", "Email", "Product", "Message"]}
          rows={leadRows.map((l) => ({
            href: `/admin/leads/contact/${l.id}`,
            cells: [when(l.created_at), str(l.name), str(l.phone), str(l.email), str(l.product_name), truncate(str(l.message), 70)],
          }))}
        />
      )}

      {tab === "carts" && (
        <Table
          empty="No abandoned carts."
          head={["Updated", "Email", "Items", "Total", "Status"]}
          rows={carts.map((c) => ({
            href: `/admin/leads/cart/${encodeURIComponent(str(c.email))}`,
            cells: [
              when(c.updated_at),
              str(c.email),
              String(JSON.parse(String(c.items || "[]")).length) + " item(s)",
              formatPrice(Number(c.total) || 0),
              Number(c.recovered) ? "Recovered" : Number(c.emailed_at) ? "Reminder sent" : "Pending",
            ],
          }))}
        />
      )}

      {tab === "questions" && (
        <Table
          empty="No chat questions yet."
          head={["When", "Type", "Product", "Message"]}
          rows={questionRows.map((e) => ({
            href: `/admin/leads/enquiry/${e.id}`,
            cells: [when(e.created_at), str(e.type), str(e.product_name) || "—", truncate(str(e.message), 70)],
          }))}
        />
      )}

      {tab === "calls" && (
        <Table
          empty="No call taps yet."
          head={["When", "Store", "Product"]}
          rows={callRows.map((e) => ({
            href: `/admin/leads/enquiry/${e.id}`,
            cells: [when(e.created_at), str(e.store_name) || "—", str(e.product_name) || "—"],
          }))}
        />
      )}
    </AdminShell>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: { cells: string[]; href: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="mt-5 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            {head.map((h) => <th key={h} className="px-4 py-2.5 font-bold">{h}</th>)}
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 hover:bg-surface">
              {r.cells.map((c, j) => (
                <td key={j} className="px-4 py-2.5 text-fg">
                  {j === 0 ? <Link href={r.href} className="font-semibold text-volt hover:underline">{c || "—"}</Link> : (c || "—")}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right whitespace-nowrap"><Link href={r.href} className="text-sm font-semibold text-volt hover:underline">View →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
