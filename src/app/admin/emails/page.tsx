import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listEmails, emailTabCounts, EMAIL_TYPE_LABELS, EMAIL_TABS } from "@/lib/email-log";
import { AdminSearch } from "@/components/admin/AdminSearch";

export const instant = false;

const STATUS_FILTERS = [
  { v: "", label: "All" },
  { v: "sent", label: "Sent" },
  { v: "failed", label: "Failed" },
  { v: "skipped", label: "Not sent" },
];

const TABS = [{ v: "", label: "All emails" }, ...EMAIL_TABS];

function statusBadge(s: string) {
  if (s === "sent") return "badge-pay";
  if (s === "failed") return "badge-sale";
  return "badge-muted";
}

export default async function AdminEmails({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status || undefined;
  const tab = EMAIL_TABS.find((t) => t.v === sp.tab);
  const q = (sp.q ?? "").trim();
  const [{ rows, total, perPage }, counts] = await Promise.all([
    listEmails({ page, perPage: 40, status, types: tab?.types, q }),
    emailTabCounts(),
  ]);
  const pages = Math.max(1, Math.ceil(total / perPage));

  const qs = (next: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (tab) p.set("tab", tab.v);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(next)) { if (v === undefined || v === "") p.delete(k); else p.set(k, String(v)); }
    const s = p.toString();
    return s ? `/admin/emails?${s}` : "/admin/emails";
  };

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl">Emails <span className="text-base text-muted">({total.toLocaleString()})</span></h1>
        <Link href="/admin/emails/new" className="btn btn-volt h-10 px-4 text-sm">✉ Compose email</Link>
      </div>
      <p className="mt-1 text-sm text-muted">Every email the site sends — order confirmations, failures, cancellations, refunds, enquiries and abandoned-cart nudges. Open one to read, resend, or edit &amp; resend.</p>

      <AdminSearch className="mt-4 max-w-xl" placeholder="Search recipient, subject or order no.…" />

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((f) => {
          const active = (tab?.v ?? "") === f.v;
          return (
            <Link key={f.label} href={qs({ tab: f.v, page: undefined })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>
              {f.label} <span className="opacity-70">({counts[f.v || "all"] ?? 0})</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = (status ?? "") === f.v;
          return (
            <Link key={f.label} href={qs({ status: f.v, page: undefined })}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${active ? "bg-fg text-ink-2" : "border border-line text-muted hover:text-fg"}`}>
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          {q || tab || status ? "No emails match." : "No emails logged yet. They’ll appear here as soon as the site sends one."}
        </p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">To</th>
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted">{new Date(e.createdAt).toLocaleString("en-ZA")}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/emails/${e.id}`} className="font-semibold text-volt hover:underline">
                        {EMAIL_TYPE_LABELS[e.type] ?? e.type}
                      </Link>
                      {e.resend && <span className="ml-1.5 badge badge-muted">resend</span>}
                      {e.orderRef && <div className="text-xs text-muted">{e.orderRef}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{e.toAddr}</td>
                    <td className="px-4 py-2.5 max-w-[320px] truncate text-fg">{e.subject}</td>
                    <td className="px-4 py-2.5"><span className={`badge ${statusBadge(e.status)}`}>{e.status === "skipped" ? "not sent" : e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={qs({ page: page - 1 })} className="btn btn-ghost h-9 px-4 text-sm">← Prev</Link>}
                {page < pages && <Link href={qs({ page: page + 1 })} className="btn btn-ghost h-9 px-4 text-sm">Next →</Link>}
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
