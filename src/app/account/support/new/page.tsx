import Link from "next/link";
import { requireCustomer } from "@/lib/customer-page";
import { listOrdersForEmail, STATUS_LABEL } from "@/lib/orders";
import { TOPIC_LABEL } from "@/lib/support";
import { formatPrice } from "@/lib/format";
import { AccountFrame } from "@/components/account/AccountNav";
import { SupportForm } from "@/components/account/SupportForm";

export const instant = false;
export const metadata = { title: "New support request" };

export default async function NewSupport({ searchParams }: { searchParams: Promise<{ order?: string; topic?: string }> }) {
  const sp = await searchParams;
  const c = await requireCustomer(`/account/support/new${sp.order ? `?order=${sp.order}` : ""}`);
  const orders = await listOrdersForEmail(c.email);
  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <Link href="/account/support" className="text-sm font-semibold text-muted hover:text-volt">← Support</Link>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">New support request</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Orders can&apos;t be changed online once they&apos;re placed. Tell us what you need and our team will sort it out with you.</p>
      <SupportForm
        topics={Object.entries(TOPIC_LABEL)}
        initialOrder={sp.order?.toUpperCase()}
        initialTopic={sp.topic}
        orders={orders.map((o) => ({
          reference: o.reference,
          date: new Date(o.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }),
          total: formatPrice(o.totals.total),
          status: STATUS_LABEL[o.status] ?? o.status,
          summary: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "),
        }))}
      />
    </AccountFrame>
  );
}
