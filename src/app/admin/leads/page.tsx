import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listLeads } from "@/lib/contacts";
import { listEnquiries } from "@/lib/enquiries";
import { listAbandoned } from "@/lib/abandoned";
import { formatPrice } from "@/lib/format";

export const instant = false;

const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};

type Tab = "leads" | "carts" | "enquiries";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "carts" || sp.tab === "enquiries" ? sp.tab : "leads";

  const [leads, enquiries, carts] = await Promise.all([listLeads(200), listEnquiries(200), listAbandoned(200)]);

  const tabs: { v: Tab; label: string; count: number }[] = [
    { v: "leads", label: "Contact leads", count: leads.length },
    { v: "carts", label: "Abandoned carts", count: carts.length },
    { v: "enquiries", label: "WhatsApp / Tyrone / call", count: enquiries.length },
  ];

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Leads &amp; Enquiries</h1>
      <p className="mt-1 text-sm text-muted">Captured from Tyrone, WhatsApp, call taps and abandoned checkouts — follow these up.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.v;
          return (
            <Link key={t.v} href={t.v === "leads" ? "/admin/leads" : `/admin/leads?tab=${t.v}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label} <span className={active ? "opacity-80" : "opacity-70"}>({t.count})</span>
            </Link>
          );
        })}
      </div>

      {tab === "leads" && (
        <Table
          empty="No leads captured yet."
          head={["When", "Email", "Phone", "Source", "Message"]}
          rows={leads.map((l) => [when(l.created_at), str(l.email), str(l.phone), str(l.source), truncate(str(l.message), 80)])}
        />
      )}

      {tab === "carts" && (
        <Table
          empty="No abandoned carts."
          head={["Updated", "Email", "Items", "Total", "Status"]}
          rows={carts.map((c) => [
            when(c.updated_at),
            str(c.email),
            String(JSON.parse(String(c.items || "[]")).length) + " item(s)",
            formatPrice(Number(c.total) || 0),
            Number(c.recovered) ? "Recovered" : Number(c.emailed_at) ? "Reminder sent" : "Pending",
          ])}
        />
      )}

      {tab === "enquiries" && (
        <Table
          empty="No enquiries yet."
          head={["When", "Type", "Product / Store", "Message"]}
          rows={enquiries.map((e) => [when(e.created_at), str(e.type), str(e.product_name) || str(e.store_name) || "—", truncate(str(e.message), 80)])}
        />
      )}
    </AdminShell>
  );
}

function str(v: unknown): string { return v == null ? "" : String(v); }
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n) + "…" : s; }

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="mt-5 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            {head.map((h) => <th key={h} className="px-4 py-2.5 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 hover:bg-surface">
              {r.map((c, j) => <td key={j} className="px-4 py-2.5 text-fg">{c || "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
