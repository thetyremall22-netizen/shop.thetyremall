import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { EmailResendForm } from "@/components/admin/EmailResendForm";
import { getEmail, EMAIL_TYPE_LABELS } from "@/lib/email-log";
import { Close } from "@/components/icons";

export const instant = false;

function statusBadge(s: string) {
  if (s === "sent") return "badge-pay";
  if (s === "failed") return "badge-sale";
  return "badge-muted";
}

export default async function AdminEmailDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await getEmail(Number(id));
  if (!e) notFound();

  const cc: string[] = (() => { try { return JSON.parse(e.cc) as string[]; } catch { return []; } })();

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/emails" className="text-sm font-bold text-volt hover:underline">← Emails</Link>
          <h1 className="mt-2 font-display text-2xl leading-tight">{e.subject || "(no subject)"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="badge badge-volt">{EMAIL_TYPE_LABELS[e.type] ?? e.type}</span>
            <span className={`badge ${statusBadge(e.status)}`}>{e.status === "skipped" ? "not sent" : e.status}</span>
            {e.resend && <span className="badge badge-muted">resend</span>}
            <span>{new Date(e.createdAt).toLocaleString("en-ZA")}</span>
          </div>
        </div>
        <Link href="/admin/emails" aria-label="Close and return to emails" title="Close"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          <h2 className="font-display text-lg">Preview</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
            <iframe srcDoc={e.html} title="Email preview" sandbox="" className="h-[560px] w-full" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="font-display text-lg">Details</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k="To" v={e.toAddr} />
              {cc.length > 0 && <Row k="CC" v={cc.join(", ")} />}
              <Row k="Provider" v={e.provider || "—"} />
              {e.orderRef && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Order</dt>
                  <dd><Link href={`/admin/orders`} className="font-semibold text-volt hover:underline">{e.orderRef}</Link></dd>
                </div>
              )}
            </dl>
            {e.status === "failed" && e.error && (
              <p className="mt-3 rounded-lg border border-sale/40 bg-sale/10 p-3 text-xs text-sale">{e.error}</p>
            )}
            {e.status === "skipped" && (
              <p className="mt-3 rounded-lg border border-line bg-surface-2 p-3 text-xs text-muted">
                This email was not sent because email wasn&apos;t configured at the time. Resend once SMTP/Resend is set up.
              </p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-display text-lg">Resend</h2>
            <p className="mt-1 text-sm text-muted">Send again as-is, or edit the recipient, subject or message first.</p>
            <div className="mt-4">
              <EmailResendForm id={e.id} to={e.toAddr} subject={e.subject} html={e.html} />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-fg break-all">{v}</dd>
    </div>
  );
}
