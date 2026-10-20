import Link from "next/link";
import { TestBadge } from "@/components/admin/TestFlag";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listLeads, leadCounts } from "@/lib/contacts";
import { listEnquiries } from "@/lib/enquiries";
import { listCarts } from "@/lib/cart-recovery";
import { AdminSearch } from "@/components/admin/AdminSearch";

export const instant = false;

const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};
function str(v: unknown): string { return v == null ? "" : String(v); }
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n) + "…" : s; }

// One tab per website form (matched on the lead's `source`), then each kind of
// activity on its own tab: Tyrone questions, older WhatsApp taps, call taps and
// abandoned carts.
const SOURCE_TABS = [
  { v: "contact", label: "Contact form" },
  { v: "whatsapp-quote", label: "WhatsApp quote" },
  { v: "whatsapp-enquiry", label: "Product enquiry (WhatsApp)" },
  { v: "whatsapp-chat", label: "WhatsApp chat" },
  { v: "tyrone", label: "Tyrone chat" },
] as const;
type TabV = (typeof SOURCE_TABS)[number]["v"] | "tyrone-questions" | "wa-taps" | "calls" | "carts";
const isSourceTab = (t: string): boolean => SOURCE_TABS.some((s) => s.v === t);

/** Case-insensitive match of a search term against any field of a row. */
function rowMatches(row: Record<string, unknown>, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return Object.values(row).some((v) => {
    const s = v == null ? "" : String(v).toLowerCase();
    return s.includes(needle) || (digits.length >= 6 && s.replace(/\D/g, "").includes(digits.slice(-9)));
  });
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const valid: string[] = [...SOURCE_TABS.map((t) => t.v), "tyrone-questions", "wa-taps", "calls", "carts"];
  const tab: TabV = valid.includes(sp.tab ?? "") ? (sp.tab as TabV) : "contact";
  const q = (sp.q ?? "").trim();

  const [counts, cartsAll, enquiries] = await Promise.all([leadCounts(), listCarts({ q, limit: 1000 }), listEnquiries(1000)]);
  const byType = (t: string) => enquiries.filter((e) => str(e.type) === t);
  // Each kind of activity on its own tab.
  const questionRows = byType("tyrone").filter((r) => rowMatches(r, q));
  const waTapRows = byType("whatsapp").filter((r) => rowMatches(r, q));
  const callRows = byType("call").filter((r) => rowMatches(r, q));
  const carts = cartsAll;
  const leadRows = isSourceTab(tab) ? await listLeads({ source: tab, limit: 500, q }) : [];
  // While searching, show how many matches each tab has.
  const leadMatchCounts: Record<string, number> = {};
  if (q) {
    const all = await listLeads({ limit: 5000, q });
    for (const l of all) leadMatchCounts[str(l.source)] = (leadMatchCounts[str(l.source)] ?? 0) + 1;
  }

  const tabs: { v: TabV; label: string; count: number }[] = [
    ...SOURCE_TABS.map((t) => ({ v: t.v as TabV, label: t.label, count: q ? leadMatchCounts[t.v] ?? 0 : counts[t.v] ?? 0 })),
    { v: "tyrone-questions", label: "Tyrone questions", count: questionRows.length },
    { v: "wa-taps", label: "WhatsApp taps (before details step)", count: waTapRows.length },
    { v: "calls", label: "Call taps", count: callRows.length },
    { v: "carts", label: "Abandoned carts →", count: carts.length },
  ];
  const tabHref = (v: TabV) => {
    const p = new URLSearchParams();
    if (v !== "contact") p.set("tab", v);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/leads?${s}` : "/admin/leads";
  };

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Leads &amp; Enquiries</h1>
      <p className="mt-1 text-sm text-muted">Every website form lands here under its own tab, plus Tyrone questions, call taps and abandoned checkouts. Open any lead to see or edit all its details.</p>

      <AdminSearch className="mt-4 max-w-xl" placeholder="Search name, email, phone, product, SKU, message…" />
      {q && <p className="mt-2 text-xs text-muted">Showing matches for “{q}”. Tab numbers show how many matches each tab has.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.v;
          return (
            <Link key={t.v} href={t.v === "carts" ? "/admin/cart-recovery" : tabHref(t.v)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label} <span className={active ? "opacity-80" : "opacity-70"}>({t.count})</span>
            </Link>
          );
        })}
      </div>

      {isSourceTab(tab) && (
        <Table
          empty={q ? "No matches on this tab." : "Nothing captured here yet."}
          head={["When", "Name", "Phone", "Email", "Product", "Message"]}
          rows={leadRows.map((l) => ({
            href: `/admin/leads/contact/${l.id}`,
            test: Number(l.test) === 1,
            cells: [when(l.created_at), str(l.name), str(l.phone), str(l.email), str(l.product_name), truncate(str(l.message), 70)],
          }))}
        />
      )}

      {tab === "carts" && (
        <p className="mt-5 text-sm text-muted">Abandoned carts now have their own tab with the recovery emails and settings: <Link href="/admin/cart-recovery" className="font-semibold text-volt hover:underline">Admin → Abandoned Cart</Link>.</p>
      )}

      {tab === "tyrone-questions" && (
        <Table
          empty={q ? "No matches." : "No Tyrone questions yet."}
          head={["When", "Question", "Product shown"]}
          rows={questionRows.map((e) => ({
            href: `/admin/leads/enquiry/${e.id}`,
            test: Number(e.test) === 1,
            cells: [when(e.created_at), truncate(str(e.message), 90), str(e.product_name) || "—"],
          }))}
        />
      )}

      {tab === "wa-taps" && (
        <>
          <p className="mt-4 text-sm text-muted">Taps on a WhatsApp button from before the “Before we chat” details step was added, so no contact details were captured. Check the business WhatsApp for these chats.</p>
          <Table
            empty={q ? "No matches." : "None."}
            head={["When", "Product", "Message"]}
            rows={waTapRows.map((e) => ({
              href: `/admin/leads/enquiry/${e.id}`,
            test: Number(e.test) === 1,
              cells: [when(e.created_at), str(e.product_name) || "—", truncate(str(e.message), 70)],
            }))}
          />
        </>
      )}

      {tab === "calls" && (
        <>
        <p className="mt-4 text-sm text-muted">Each row is someone tapping a phone number on the website to call a store. The caller isn&apos;t identified; this shows which stores and products get calls.</p>
        <Table
          empty="No call taps yet."
          head={["When", "Store", "Product"]}
          rows={callRows.map((e) => ({
            href: `/admin/leads/enquiry/${e.id}`,
            test: Number(e.test) === 1,
            cells: [when(e.created_at), str(e.store_name) || "—", str(e.product_name) || "—"],
          }))}
        />
        </>
      )}
    </AdminShell>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: { cells: string[]; href: string; test?: boolean }[]; empty: string }) {
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
                  {j === 0 ? <><Link href={r.href} className="font-semibold text-volt hover:underline">{c || "—"}</Link><TestBadge test={r.test} /></> : (c || "—")}
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
