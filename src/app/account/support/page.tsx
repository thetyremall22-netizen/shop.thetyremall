import Link from "next/link";
import { requireCustomer } from "@/lib/customer-page";
import { listClientSupport, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";
import { AccountFrame } from "@/components/account/AccountNav";

export const instant = false;
export const metadata = { title: "Support" };

const date = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export default async function MySupport() {
  const c = await requireCustomer("/account/support");
  const list = await listClientSupport(c.id);
  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Support</h1>
          <p className="mt-1 text-sm text-muted">Need to change an order, add items or cancel? Send us a request and follow our replies here.</p>
        </div>
        <Link href="/account/support/new" className="btn btn-volt h-11 px-5">New request</Link>
      </div>
      {list.length === 0 ? (
        <div className="card mt-6 p-5 text-sm text-muted">You haven&apos;t sent any requests yet.</div>
      ) : (
        <div className="mt-6 space-y-2">
          {list.map((s) => (
            <Link key={s.id} href={`/account/support/${s.ref}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:border-volt">
              <span className="font-bold text-fg">{s.ref}</span>
              <span className="text-sm text-fg">{TOPIC_LABEL[s.topic]}</span>
              {s.orderRefs.length > 0 && <span className="text-sm text-muted">{s.orderRefs.join(", ")}</span>}
              <span className="text-xs text-muted">Updated {date(s.updatedAt)}</span>
              <span className={`badge ml-auto ${s.lastBy === "staff" && !["resolved", "closed"].includes(s.status) ? "badge-volt" : SUPPORT_STATUS_BADGE[s.status]}`}>
                {s.lastBy === "staff" && !["resolved", "closed"].includes(s.status) ? "New reply" : SUPPORT_STATUS_LABEL[s.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AccountFrame>
  );
}
