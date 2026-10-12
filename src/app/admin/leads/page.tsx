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

export default async function AdminLeadsPage() {
  await requireAdmin();
  const [leads, enquiries, carts] = await Promise.all([listLeads(100), listEnquiries(100), listAbandoned(100)]);

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Leads &amp; Enquiries</h1>
      <p className="mt-1 text-sm text-muted">Captured from Tyrone, WhatsApp, call taps and abandoned checkouts — follow these up.</p>

      {/* Contact leads */}
      <h2 className="mt-8 font-display text-xl">Contact leads ({leads.length})</h2>
      <Table
        empty="No leads captured yet."
        head={["When", "Email", "Phone", "Source", "Message"]}
        rows={leads.map((l) => [when(l.created_at), str(l.email), str(l.phone), str(l.source), truncate(str(l.message), 60)])}
      />

      {/* Abandoned carts */}
      <h2 className="mt-8 font-display text-xl">Abandoned carts ({carts.length})</h2>
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

      {/* Enquiries */}
      <h2 className="mt-8 font-display text-xl">WhatsApp / Tyrone / call enquiries ({enquiries.length})</h2>
      <Table
        empty="No enquiries yet."
        head={["When", "Type", "Product / Store", "Message"]}
        rows={enquiries.map((e) => [when(e.created_at), str(e.type), str(e.product_name) || str(e.store_name) || "—", truncate(str(e.message), 60)])}
      />
    </AdminShell>
  );
}

function str(v: unknown): string { return v == null ? "" : String(v); }
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n) + "…" : s; }

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-ink-2">
            {head.map((h) => <th key={h} className="px-4 py-2.5 font-bold text-muted">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => <td key={j} className="px-4 py-2.5 text-fg">{c || "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
