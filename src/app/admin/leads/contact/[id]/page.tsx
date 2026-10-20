import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { getLead } from "@/lib/contacts";
import { listAudit } from "@/lib/audit";
import { can } from "@/lib/admin-users";
import { LeadEditor } from "@/components/admin/LeadEditor";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { Close } from "@/components/icons";

export const instant = false;

const str = (v: unknown) => (v == null ? "" : String(v));
const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};

export default async function ContactLeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const l = await getLead(Number(id));
  if (!l) notFound();
  const history = await listAudit("lead", Number(id));

  const name = str(l.name);
  const email = str(l.email);

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/leads" className="text-sm font-bold text-volt hover:underline">← Leads &amp; Enquiries</Link>
          <h1 className="mt-2 font-display text-2xl leading-tight">{name || email || "Contact lead"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="badge badge-volt">{SOURCE_LABEL[str(l.source)] ?? (str(l.source) || "Lead")}</span>
            <span>{when(l.created_at)}</span>
          </div>
        </div>
        <Link href={`/admin/leads${str(l.source) && str(l.source) !== "contact" ? `?tab=${str(l.source)}` : ""}`} aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <LeadEditor
            id={Number(id)}
            canEdit={can(me.role, "leads.edit")}
            initial={{
              name, email, phone: str(l.phone), product_name: str(l.product_name), sku: str(l.sku),
              product_url: str(l.product_url), message: str(l.message), notes: str(l.notes),
            }}
          />
          <AuditHistory
            entries={history}
            empty={`Received ${when(l.created_at)} via ${SOURCE_LABEL[str(l.source)] ?? str(l.source)}. No edits yet.`}
          />
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

const SOURCE_LABEL: Record<string, string> = {
  "contact": "Contact form",
  "whatsapp-quote": "WhatsApp quote",
  "whatsapp-enquiry": "Product enquiry (WhatsApp)",
  "whatsapp-chat": "WhatsApp chat",
  "tyrone": "Tyrone chat",
};
