import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { getEnquiry } from "@/lib/enquiries";
import { extractContact } from "@/lib/contacts";
import { formatPrice } from "@/lib/format";
import { Close } from "@/components/icons";

export const instant = false;

const str = (v: unknown) => (v == null ? "" : String(v));
const when = (ms: unknown) => {
  const n = Number(ms);
  return n ? new Date(n).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—";
};

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await getEnquiry(Number(id));
  if (!e) notFound();

  const message = str(e.message);
  const product = str(e.product_name);
  const { email, phone } = extractContact(message);

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/leads?tab=enquiries" className="text-sm font-bold text-volt hover:underline">← Leads &amp; Enquiries</Link>
          <h1 className="mt-2 font-display text-2xl leading-tight">{product || `${str(e.type)} enquiry`}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="badge badge-volt">{str(e.type)} enquiry</span>
            <span>{when(e.created_at)}</span>
          </div>
        </div>
        <Link href="/admin/leads?tab=enquiries" aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="card p-5">
          <h2 className="font-display text-lg">Details</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Type" v={str(e.type) || "—"} />
            {product && <Row k="Product" v={product} />}
            {str(e.sku) && <Row k="SKU" v={str(e.sku)} />}
            {e.price != null && str(e.price) !== "" && <Row k="Price" v={formatPrice(Number(e.price) || 0)} />}
            {str(e.store_name) && <Row k="Store" v={str(e.store_name)} />}
            {str(e.product_slug) && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Link</dt>
                <dd className="text-right"><Link href={`/product/${str(e.product_slug)}`} target="_blank" className="text-volt hover:underline">View product ↗</Link></dd>
              </div>
            )}
          </dl>
          {message && (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Message</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{message}</p>
            </>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-display text-lg">Email this customer</h2>
          <p className="mt-1 text-sm text-muted">
            {email ? "We found an email in the message — pre-filled below." : "No email was captured with this enquiry — enter the customer's address to reply."}
            {phone ? ` Phone in message: ${phone}.` : ""}
          </p>
          <div className="mt-3">
            <ComposeEmailForm
              initialTo={email ?? ""}
              initialSubject={product ? `The Tyre Mall — about ${product}` : "The Tyre Mall — your enquiry"}
              initialMessage={`Hi,\n\nThanks for your enquiry${product ? ` about the ${product}` : ""}. `}
            />
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
