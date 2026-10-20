import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer-page";
import { getClientSupportRequest, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";
import { AccountFrame } from "@/components/account/AccountNav";
import { SupportReply } from "@/components/account/SupportForm";

export const instant = false;

const when = (ms: number) => new Date(ms).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function MySupportRequest({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { ref } = await params;
  const sp = await searchParams;
  const c = await requireCustomer(`/account/support/${ref}`);
  const r = await getClientSupportRequest(decodeURIComponent(ref), c.id);
  if (!r) notFound();
  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <Link href="/account/support" className="text-sm font-semibold text-muted hover:text-volt">← Support</Link>
      {sp.sent && <p className="mt-3 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm font-semibold text-fg">✓ Request sent. We&apos;ve emailed you a copy and will reply as soon as possible.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">{r.ref}</h1>
        <span className={`badge ${SUPPORT_STATUS_BADGE[r.status]}`}>{SUPPORT_STATUS_LABEL[r.status]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {TOPIC_LABEL[r.topic]}
        {r.orderRefs.length > 0 && <> · {r.orderRefs.map((o, i) => <span key={o}>{i ? ", " : ""}<Link href={`/account/orders/${o}`} className="font-semibold text-volt hover:underline">{o}</Link></span>)}</>}
      </p>
      <div className="mt-6 space-y-3">
        {r.messages?.map((m) => (
          <div key={m.id} className={`max-w-[90%] rounded-xl border p-4 text-sm ${m.author === "staff" ? "border-volt/40 bg-volt/5" : "ml-auto border-line bg-surface-2"}`}>
            <div className="mb-1 text-xs font-semibold text-muted">{m.author === "staff" ? "The Tyre Mall team" : "You"} · {when(m.createdAt)}</div>
            <div className="whitespace-pre-wrap text-fg">{m.body}</div>
          </div>
        ))}
      </div>
      <div className="mt-6"><SupportReply reference={r.ref} closed={r.status === "closed"} /></div>
    </AccountFrame>
  );
}
