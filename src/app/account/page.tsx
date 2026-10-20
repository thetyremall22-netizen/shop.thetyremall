import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCustomer } from "@/lib/customers";
import { listOrdersForEmail, STATUS_LABEL, STATUS_BADGE } from "@/lib/orders";
import { listClientSupport, SUPPORT_STATUS_LABEL, SUPPORT_STATUS_BADGE, TOPIC_LABEL } from "@/lib/support";
import { wishlistSlugs } from "@/lib/wishlist";
import { formatPrice } from "@/lib/format";
import { AuthForms } from "@/components/account/AuthForms";
import { AccountFrame } from "@/components/account/AccountNav";

export const instant = false;

const date = (iso: string | number) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const c = await getCustomer();

  if (!c) {
    return (
      <div className="container-x grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-16">
        <div className="max-w-lg">
          <span className="badge badge-volt">CLIENT ZONE</span>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">Your Tyre Mall account</h1>
          <ul className="mt-6 space-y-3 text-sm text-muted">
            {[
              ["📦", "All your orders in one place", "see every order, its status and what you paid."],
              ["♥", "A wishlist that follows you", "save tyres and wheels, and get an email when they go on sale or come back in stock."],
              ["💬", "Help with an order", "ask for a change, add items or request a cancellation, and follow our replies."],
              ["⚡", "Faster checkout", "your details and delivery address are filled in for you."],
            ].map(([i, t, d]) => (
              <li key={t} className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-volt/15 text-volt">{i}</span><span><b className="text-fg">{t}</b>: {d}</span></li>
            ))}
          </ul>
        </div>
        <Suspense><AuthForms /></Suspense>
      </div>
    );
  }

  const [orders, support, wish] = await Promise.all([listOrdersForEmail(c.email, 5), listClientSupport(c.id), wishlistSlugs(c.id).catch(() => [])]);
  const openSupport = support.filter((s) => ["open", "in_progress", "waiting"].includes(s.status));

  return (
    <AccountFrame name={`${c.firstName} ${c.lastName}`}>
      {sp.welcome && <p className="mb-4 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm font-semibold text-fg">✓ Your email is confirmed and your account is ready. Welcome, {c.firstName}!</p>}
      {sp.reset && <p className="mb-4 rounded-xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm font-semibold text-fg">✓ Your new password is saved. You&apos;re signed in.</p>}
      <h1 className="font-display text-3xl sm:text-4xl">Hi {c.firstName}</h1>
      <p className="mt-1 text-sm text-muted">Signed in as {c.email}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/account/orders" className="card p-4 hover:border-volt"><div className="text-xs font-semibold uppercase text-muted">Orders</div><div className="font-display text-3xl">{orders.length >= 5 ? "5+" : orders.length}</div></Link>
        <Link href="/wishlist" className="card p-4 hover:border-volt"><div className="text-xs font-semibold uppercase text-muted">Wishlist</div><div className="font-display text-3xl">{wish.length}</div></Link>
        <Link href="/account/support" className="card p-4 hover:border-volt"><div className="text-xs font-semibold uppercase text-muted">Open support requests</div><div className="font-display text-3xl">{openSupport.length}</div></Link>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between"><h2 className="font-display text-2xl">Recent orders</h2><Link href="/account/orders" className="text-sm font-bold text-volt hover:underline">All orders →</Link></div>
        {orders.length === 0 ? (
          <div className="card mt-3 p-5 text-sm text-muted">No orders yet for {c.email}. Orders you place with this email address show here automatically, including ones placed before you created your account. <Link href="/shop" className="font-bold text-volt hover:underline">Start shopping →</Link></div>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.slice(0, 3).map((o) => (
              <Link key={o.id} href={`/account/orders/${o.reference}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:border-volt">
                <span className="font-bold text-fg">{o.reference}</span>
                <span className="text-sm text-muted">{date(o.createdAt)}</span>
                <span className={`badge ${STATUS_BADGE[o.status] ?? "badge-muted"}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                <span className="ml-auto font-semibold text-fg">{formatPrice(o.totals.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {openSupport.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Open support requests</h2>
          <div className="mt-3 space-y-2">
            {openSupport.slice(0, 3).map((s) => (
              <Link key={s.id} href={`/account/support/${s.ref}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:border-volt">
                <span className="font-bold text-fg">{s.ref}</span>
                <span className="text-sm text-muted">{TOPIC_LABEL[s.topic]}</span>
                <span className={`badge ${SUPPORT_STATUS_BADGE[s.status]}`}>{s.lastBy === "staff" && s.status !== "resolved" ? "New reply" : SUPPORT_STATUS_LABEL[s.status]}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AccountFrame>
  );
}
