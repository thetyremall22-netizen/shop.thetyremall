import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { CartsTable, RunNowButton, RecoverySettingsForm } from "@/components/admin/CartRecoveryAdmin";
import { listCarts, recoveryStats, getRecoverySettings, STATUS_LABEL } from "@/lib/cart-recovery";

export const instant = false;

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FILTERS = [{ v: "", label: "All" }, { v: "open", label: "Open (in the flow)" }, ...(["abandoned", "pending", "contacted", "clicked", "recovered", "purchased", "lost"] as const).map((s) => ({ v: s, label: STATUS_LABEL[s] }))];

export default async function CartRecoveryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("leads.view");
  const sp = await searchParams;
  const tab = sp.tab === "settings" ? "settings" : "carts";
  const canSettings = can(me.role, "deals.manage");
  const q = (sp.q ?? "").trim();
  const status = FILTERS.some((f) => f.v === sp.status) ? sp.status : "";

  const [stats, carts, settings] = await Promise.all([
    recoveryStats(),
    tab === "carts" ? listCarts({ status: status || undefined, q }) : Promise.resolve([]),
    getRecoverySettings(),
  ]);
  const qs = (patch: Record<string, string>) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    const s = u.toString();
    return s ? `/admin/cart-recovery?${s}` : "/admin/cart-recovery";
  };

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Abandoned carts</h1>
      <p className="mt-1 text-sm text-muted">
        Shoppers who started checkout but didn&apos;t finish (and unpaid or failed orders) get up to 3 friendly recovery emails with a one-click link that restores their cart.
        A cart only counts as <b className="text-fg">recovered</b> when the customer came back through that link or the exit popup and then paid.
      </p>
      {!settings.enabled && <p className="mt-3 rounded-lg border border-sale/40 bg-sale/10 px-3 py-2 text-sm font-semibold text-sale">Cart Recovery is switched off. Turn it on under Settings.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/cart-recovery" className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === "carts" ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>Carts</Link>
        {canSettings && <Link href="/admin/cart-recovery?tab=settings" className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === "settings" ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>Recovery settings</Link>}
      </div>

      {tab === "carts" && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Tracked", stats.tracked], ["In the flow", stats.open], ["Contacted", stats.contacted], ["Clicked", stats.clicked],
              ["Recovered", stats.recovered], ["Recovered value", zar(stats.recoveredValue)], ["Lost", stats.lost],
            ].map(([k, v]) => (
              <div key={String(k)} className="card p-3"><div className="text-xs text-muted">{k}</div><div className="mt-1 font-display text-xl text-fg">{v}</div></div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <AdminSearch className="min-w-[260px] flex-1" placeholder="Search email, name, phone, product, order no.…" />
            {can(me.role, "leads.reply") && <RunNowButton />}
            <a href={`/api/admin/cart-recovery/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`} className="btn btn-dark h-10 px-4 text-sm">Export CSV</a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link key={f.v || "all"} href={qs({ status: f.v })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${status === f.v ? "bg-fg text-ink-2" : "border border-line text-muted hover:text-fg"}`}>{f.label}</Link>
            ))}
          </div>
          <div className="mt-4">
            <CartsTable canAct={can(me.role, "leads.reply")} canDelete={can(me.role, "leads.edit")}
              rows={carts.map((c) => ({
                id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, source: c.source, status: c.status,
                items: c.items.map((i) => ({ name: i.name, qty: i.qty })), total: c.total, emailsSent: c.emailsSent, lastEmailAt: c.lastEmailAt,
                orderRef: c.orderRef, recoveredOrderRef: c.recoveredOrderRef, createdAt: c.createdAt, updatedAt: c.updatedAt, test: c.test,
              }))} />
          </div>
        </>
      )}

      {tab === "settings" && canSettings && (
        <div className="mt-5 max-w-3xl"><RecoverySettingsForm initial={settings} /></div>
      )}

      <p className="mt-10 text-center text-xs text-faint">Cart Recovery · by <a href="https://iheartdigital.co.za" target="_blank" rel="noopener noreferrer" className="hover:text-volt">iHeart Digital</a></p>
    </AdminShell>
  );
}
