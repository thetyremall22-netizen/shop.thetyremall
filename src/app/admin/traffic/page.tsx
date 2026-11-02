import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { trafficReport } from "@/lib/visit-sources";
import { BUCKET_LABEL, type Bucket } from "@/lib/attribution";

export const instant = false;

const PERIODS = [7, 30, 90] as const;
const n = (v: number) => (v ? v.toLocaleString("en-ZA") : "—");
const pct = (a: number, b: number) => (a && b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// The daily table's columns (the rest are added up under "Other").
const DAY_COLS: { label: string; buckets: Bucket[] }[] = [
  { label: "Google Ads", buckets: ["google-ads"] },
  { label: "Google free listings", buckets: ["google-free"] },
  { label: "Google search", buckets: ["google-search"] },
  { label: "Bing (ads + search)", buckets: ["bing-ads", "bing-search"] },
  { label: "AI assistants", buckets: ["ai"] },
  { label: "Direct", buckets: ["direct"] },
];
const SHOWN = new Set(DAY_COLS.flatMap((c) => c.buckets));

export default async function TrafficPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("orders.view");
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.days) ?? 30;
  const { daily, bySource, trackingSince } = await trafficReport(days);
  const totals = bySource.reduce((t, s) => ({ visits: t.visits + s.visits, orders: t.orders + s.orders, paid: t.paid + s.paid, leads: t.leads + s.leads }), { visits: 0, orders: 0, paid: 0, leads: 0 });
  const sources = bySource.filter((s) => s.visits || s.orders || s.leads).sort((a, b) => b.visits - a.visits || b.orders - a.orders);
  const since = trackingSince ? new Date(trackingSince).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Traffic sources</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Where visitors come from — Google Ads clicks, free Google listings, Google and Bing search, AI assistants (ChatGPT, Gemini…), email and more — next to the orders and enquiries they led to.
        {since ? ` Visits are counted from ${since}.` : " Visits will show here as soon as people visit the website."} Orders and enquiries are credited to the visit they came in on (sources for enquiries are recorded from 2 November 2026).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link key={p} href={p === 30 ? "/admin/traffic" : `/admin/traffic?days=${p}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${days === p ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
            Last {p} days
          </Link>
        ))}
      </div>

      <h2 className="mt-6 font-display text-xl">By source</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-bold">Source</th>
              <th className="px-4 py-2.5 text-right font-bold">Visits</th>
              <th className="px-4 py-2.5 text-right font-bold">Orders placed</th>
              <th className="px-4 py-2.5 text-right font-bold">Paid orders</th>
              <th className="px-4 py-2.5 text-right font-bold">Leads &amp; enquiries</th>
              <th className="px-4 py-2.5 text-right font-bold">Visits → paid order</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.bucket} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold text-fg">{BUCKET_LABEL[s.bucket]}</td>
                <td className="px-4 py-2.5 text-right">{n(s.visits)}</td>
                <td className="px-4 py-2.5 text-right">{n(s.orders)}</td>
                <td className="px-4 py-2.5 text-right">{n(s.paid)}</td>
                <td className="px-4 py-2.5 text-right">{n(s.leads)}</td>
                <td className="px-4 py-2.5 text-right text-muted">{pct(s.paid, s.visits)}</td>
              </tr>
            ))}
            {!sources.length && <tr><td colSpan={6} className="px-4 py-4 text-muted">Nothing recorded in this period yet.</td></tr>}
            <tr className="border-t border-line bg-surface font-bold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right">{n(totals.visits)}</td>
              <td className="px-4 py-2.5 text-right">{n(totals.orders)}</td>
              <td className="px-4 py-2.5 text-right">{n(totals.paid)}</td>
              <td className="px-4 py-2.5 text-right">{n(totals.leads)}</td>
              <td className="px-4 py-2.5 text-right text-muted">{pct(totals.paid, totals.visits)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Orders and leads with no recorded source (older ones) appear in the daily table below but not in this one. Staff test orders aren&apos;t counted.</p>

      <h2 className="mt-8 font-display text-xl">Day by day</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5 font-bold">Day</th>
              <th className="px-3 py-2.5 text-right font-bold">All visits</th>
              {DAY_COLS.map((c) => <th key={c.label} className="px-3 py-2.5 text-right font-bold">{c.label}</th>)}
              <th className="px-3 py-2.5 text-right font-bold">Other</th>
              <th className="border-l border-line px-3 py-2.5 text-right font-bold">Orders</th>
              <th className="px-3 py-2.5 text-right font-bold">Paid</th>
              <th className="px-3 py-2.5 text-right font-bold">Leads</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => {
              const other = Object.entries(d.visits).filter(([b]) => !SHOWN.has(b as Bucket)).reduce((t, [, v]) => t + v, 0);
              return (
                <tr key={d.day} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-fg">{dayLabel(d.day)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{n(d.total)}</td>
                  {DAY_COLS.map((c) => <td key={c.label} className="px-3 py-2 text-right">{n(c.buckets.reduce((t, b) => t + d.visits[b], 0))}</td>)}
                  <td className="px-3 py-2 text-right">{n(other)}</td>
                  <td className="border-l border-line px-3 py-2 text-right">{n(d.orders)}</td>
                  <td className="px-3 py-2 text-right">{n(d.paid)}</td>
                  <td className="px-3 py-2 text-right">{n(d.leads)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        A visit starts when someone arrives on the website (or comes back after 30 minutes away). Only real browsers are counted — not Google&apos;s or other robots — and staff signed in to the admin are left out.
        Google Ads counts clicks in its own reports, so its numbers can be a little higher (e.g. people who click an ad and leave before the page loads).
      </p>
    </AdminShell>
  );
}
