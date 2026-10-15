import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { getLead } from "@/lib/contacts";
import { Close } from "@/components/icons";

export const instant = false;

const str = (v: unknown) => (v == null ? "" : String(v));
const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};

export default async function ContactLeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const l = await getLead(Number(id));
  if (!l) notFound();

  const name = str(l.name);
  const email = str(l.email);

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/leads" className="text-sm font-bold text-volt hover:underline">← Leads &amp; Enquiries</Link>
          <h1 className="mt-2 font-display text-2xl leading-tight">{name || email || "Contact lead"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="badge badge-volt">Contact lead</span>
            <span>{when(l.created_at)}</span>
          </div>
        </div>
        <Link href="/admin/leads" aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="card p-5">
          <h2 className="font-display text-lg">Details</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Name" v={name || "—"} />
            <Row k="Email" v={email || "—"} />
            <Row k="Phone" v={str(l.phone) || "—"} />
            <Row k="Source" v={str(l.source) || "—"} />
          </dl>
          {str(l.message) && (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Message</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{str(l.message)}</p>
            </>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-display text-lg">Email this customer</h2>
          {email ? (
            <div className="mt-3">
              <ComposeEmailForm
                initialTo={email}
                initialSubject="The Tyre Mall — following up on your enquiry"
                initialMessage={`Hi${name ? " " + name.split(" ")[0] : ""},\n\nThanks for getting in touch with The Tyre Mall. `}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No email address was captured for this lead{str(l.phone) ? ` — reach them on ${str(l.phone)}.` : "."}</p>
          )}
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
