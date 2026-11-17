import Link from "next/link";
import { TestBadge } from "@/components/admin/TestFlag";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listLeads, leadCounts } from "@/lib/contacts";
import { listEnquiries } from "@/lib/enquiries";
import { listCarts } from "@/lib/cart-recovery";
import { journeyCount } from "@/lib/tyrone-journey";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { OriginBadge } from "@/components/admin/OriginBadge";
import { classifyOrigin, parseAttribution } from "@/lib/attribution";

export const instant = false;

/** Date on one line, time under it (never wraps word-by-word). */
const when = (ms: unknown): React.ReactNode => {
  const n = Number(ms);
  if (!n) return "—";
  const d = new Date(n);
  return (
    <span className="whitespace-nowrap">
      {d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
      <span className="block text-xs font-normal text-muted">{d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
    </span>
  );
};
/** Name, phone and email stacked in one column. */
function contactCell(row: Record<string, unknown>): React.ReactNode {
  const name = str(row.name), phone = str(row.phone), email = str(row.email);
  if (!name && !phone && !email) return "";
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold">{name || "—"}</div>
      {phone && <div className="whitespace-nowrap text-xs text-muted">{phone}</div>}
      {email && <div className="truncate text-xs text-muted" title={email}>{email}</div>}
    </div>
  );
}
/** Up to 3 lines of text, full text on hover. */
const clamp = (text: string, lines: 2 | 3 = 3): React.ReactNode =>
  text ? <span className={`${lines === 2 ? "line-clamp-2" : "line-clamp-3"} whitespace-pre-line`} title={text}>{text}</span> : "";
function str(v: unknown): string { return v == null ? "" : String(v); }
/** "Came from" badge (Google Ads, search…); "—" for ones from before 2 Nov 2026 when this started. */
function cameFrom(row: Record<string, unknown>): React.ReactNode {
  const a = parseAttribution(row.attribution);
  return a ? <OriginBadge origin={classifyOrigin(a)} /> : "";
}

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
type TabV = (typeof SOURCE_TABS)[number]["v"] | "tyrone-convos" | "tyrone-questions" | "wa-taps" | "calls" | "carts";
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
  const valid: string[] = [...SOURCE_TABS.map((t) => t.v), "tyrone-convos", "tyrone-questions", "wa-taps", "calls", "carts"];
  const tab: TabV = valid.includes(sp.tab ?? "") ? (sp.tab as TabV) : "contact";
  const q = (sp.q ?? "").trim();

  const [counts, cartsAll, enquiries, convoCount] = await Promise.all([leadCounts(), listCarts({ q, limit: 1000 }), listEnquiries(1000), journeyCount()]);
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
    { v: "tyrone-convos", label: "Tyrone conversations →", count: convoCount },
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
            <Link key={t.v} href={t.v === "carts" ? "/admin/cart-recovery" : t.v === "tyrone-convos" ? "/admin/leads/tyrone" : tabHref(t.v)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {t.label} <span className={active ? "opacity-80" : "opacity-70"}>({t.count})</span>
            </Link>
          );
        })}
      </div>

      {isSourceTab(tab) && (() => {
        // Only show the Product column on tabs where leads have a product.
        const withProduct = leadRows.some((l) => str(l.product_name));
        return (
          <Table
            empty={q ? "No matches on this tab." : "Nothing captured here yet."}
            head={withProduct ? ["When", "Contact", "Came from", "Product", "Message"] : ["When", "Contact", "Came from", "Message"]}
            cols={withProduct ? [W_WHEN, W_CONTACT, W_FROM, "w-[22%]", ""] : [W_WHEN, W_CONTACT, W_FROM, ""]}
            rows={leadRows.map((l) => ({
              href: `/admin/leads/contact/${l.id}`,
              test: Number(l.test) === 1,
              cells: withProduct
                ? [when(l.created_at), contactCell(l), cameFrom(l), clamp(str(l.product_name), 2), clamp(str(l.message))]
                : [when(l.created_at), contactCell(l), cameFrom(l), clamp(str(l.message))],
            }))}
          />
        );
      })()}

      {tab === "carts" && (
        <p className="mt-5 text-sm text-muted">Abandoned carts now have their own tab with the recovery emails and settings: <Link href="/admin/cart-recovery" className="font-semibold text-volt hover:underline">Admin → Abandoned Cart</Link>.</p>
      )}

      {tab === "tyrone-questions" && (
        <Table
          empty={q ? "No matches." : "No Tyrone questions yet."}
          head={["When", "Question", "Came from", "Product shown"]}
          cols={[W_WHEN, "", W_FROM, "w-[26%]"]}
          rows={questionRows.map((e) => ({
            href: `/admin/leads/enquiry/${e.id}`,
            test: Number(e.test) === 1,
            cells: [when(e.created_at), clamp(str(e.message)), cameFrom(e), clamp(str(e.product_name), 2) || "—"],
          }))}
        />
      )}

      {tab === "wa-taps" && (
        <>
          <p className="mt-4 text-sm text-muted">Taps on a WhatsApp button from before the “Before we chat” details step was added, so no contact details were captured. Check the business WhatsApp for these chats.</p>
          <Table
            empty={q ? "No matches." : "None."}
            head={["When", "Product", "Message"]}
            cols={[W_WHEN, "w-[30%]", ""]}
            rows={waTapRows.map((e) => ({
              href: `/admin/leads/enquiry/${e.id}`,
            test: Number(e.test) === 1,
              cells: [when(e.created_at), clamp(str(e.product_name), 2) || "—", clamp(str(e.message))],
            }))}
          />
        </>
      )}

      {tab === "calls" && (
        <>
        <p className="mt-4 text-sm text-muted">Each row is someone tapping a phone number on the website to call a store. The caller isn&apos;t identified; this shows which stores and products get calls.</p>
        <Table
          empty="No call taps yet."
          head={["When", "Store", "Came from", "Product"]}
          cols={[W_WHEN, "w-[24%]", W_FROM, ""]}
          rows={callRows.map((e) => ({
            href: `/admin/leads/enquiry/${e.id}`,
            test: Number(e.test) === 1,
            cells: [when(e.created_at), str(e.store_name) || "—", cameFrom(e), str(e.product_name) || "—"],
          }))}
        />
        </>
      )}
    </AdminShell>
  );
}

// Column widths (fixed table layout: the message column takes what's left).
const W_WHEN = "w-[112px]";
const W_CONTACT = "w-[24%]";
const W_FROM = "w-[150px]";

function Table({ head, cols = [], rows, empty }: { head: string[]; cols?: string[]; rows: { cells: React.ReactNode[]; href: string; test?: boolean }[]; empty: string }) {
  if (rows.length === 0) return <p className="mt-5 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[820px] table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            {head.map((h, j) => <th key={h} className={`px-3 py-2.5 font-bold ${cols[j] ?? ""}`}>{h}</th>)}
            <th className="w-[72px] px-3 py-2.5"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0 hover:bg-surface">
              {r.cells.map((c, j) => (
                <td key={j} className="overflow-hidden px-3 py-3 text-fg">
                  {j === 0 ? <><Link href={r.href} className="font-semibold text-volt hover:underline">{c || "—"}</Link><TestBadge test={r.test} /></> : (c || <span className="text-muted">—</span>)}
                </td>
              ))}
              <td className="whitespace-nowrap px-3 py-3 text-right"><Link href={r.href} className="text-sm font-semibold text-volt hover:underline">View →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
