import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { CartsTable, RunNowButton, RecoverySettingsForm } from "@/components/admin/CartRecoveryAdmin";
import { listCarts, recoveryStats, getRecoverySettings, STATUS_LABEL } from "@/lib/cart-recovery";
import { cancelReasonsByRef } from "@/lib/cancel-reasons";

export const instant = false;

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// "All" = every real abandoned cart. Carts paid straight away at checkout (never
// abandoned) are hidden unless their own filter is picked.
const FILTERS = [
  { v: "", label: "All abandoned" }, { v: "open", label: "Open (in the flow)" },
  ...(["abandoned", "pending", "contacted", "clicked", "recovered"] as const).map((s) => ({ v: s, label: STATUS_LABEL[s] })),
  { v: "popup", label: "Tapped the exit popup" },
  { v: "email_click", label: "Clicked a recovery email" },
  { v: "after_email", label: "Bought after a recovery email" },
  { v: "lost", label: STATUS_LABEL.lost },
  { v: "purchased", label: "Paid straight away (not abandoned)" },
  { v: "all", label: "Everything" },
];

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
  const cancelWhy = await cancelReasonsByRef(carts.map((c) => c.orderRef ?? "").filter(Boolean));
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
        A cart counts as <b className="text-fg">recovered</b> when the customer came back through that link or the exit popup and then paid.
        <b className="text-fg"> Bought after a recovery email</b> counts customers who were emailed and then paid without clicking the link (they came back another way).
        Every checkout is saved the moment an email is typed, so carts that were <b className="text-fg">paid straight away</b> (never abandoned) are hidden here — pick that filter to see them.
      </p>
      {!settings.enabled && <p className="mt-3 rounded-lg border border-sale/40 bg-sale/10 px-3 py-2 text-sm font-semibold text-sale">Cart Recovery is switched off. Turn it on under Settings.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/cart-recovery" className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === "carts" ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>Carts</Link>
        {canSettings && <Link href="/admin/cart-recovery?tab=settings" className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === "settings" ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>Recovery settings</Link>}
      </div>

      {tab === "carts" && (
        <>
          {/* What recovery brought in */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Recovered — email link" value={zar(stats.recoveredEmailValue)} sub={`${stats.recoveredEmail} order${stats.recoveredEmail === 1 ? "" : "s"} · clicked the email, then paid`} strong />
            <Tile label="Recovered — exit popup" value={zar(stats.recoveredPopupValue)} sub={`${stats.recoveredPopup} order${stats.recoveredPopup === 1 ? "" : "s"} · tapped the popup, then paid`} strong />
            <Tile label="Bought after a recovery email" value={zar(stats.afterEmailValue)} sub={`${stats.afterEmail} order${stats.afterEmail === 1 ? "" : "s"} · emailed, paid without clicking`} strong />
            <Tile label="Total helped by recovery" value={zar(stats.recoveredValue + stats.afterEmailValue)} sub={`${stats.recovered + stats.afterEmail} order${stats.recovered + stats.afterEmail === 1 ? "" : "s"}`} strong />
          </div>
          {/* Exit popup */}
          <div className="mt-3 card p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Exit popup</div>
            {stats.popup.since ? (
              <p className="mt-1 text-fg">
                Shown <b>{stats.popup.shownDesktop + stats.popup.shownMobile}</b> times
                <span className="text-muted"> ({stats.popup.shownMobile} on phones, {stats.popup.shownDesktop} on computers)</span>
                {" · "}tapped <b>{stats.popup.tappedDesktop + stats.popup.tappedMobile}</b>
                <span className="text-muted"> ({stats.popup.tappedMobile} phones, {stats.popup.tappedDesktop} computers)</span>
                <span className="text-xs text-faint"> · counted since {new Date(stats.popup.since).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</span>
              </p>
            ) : (
              <p className="mt-1 text-muted">Not shown yet since counting started. {settings.exitPopup.enabled ? "It shows on computers when the pointer leaves the window, and on phones when they press Back on the cart or checkout, or come back to the site after switching away." : "It's switched off — turn it on under Recovery settings."}</p>
            )}
          </div>
          {/* The flow */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Tracked", stats.tracked], ["In the flow", stats.open], ["Contacted", stats.contacted], ["Clicked", stats.clicked],
              ["Lost", stats.lost], ["Paid straight away (not abandoned)", stats.purchased],
            ].map(([k, v]) => <Tile key={String(k)} label={String(k)} value={String(v)} />)}
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
                clickedVia: c.clickedVia, boughtAfterEmail: c.boughtAfterEmail,
                orderNote: c.orderRef && cancelWhy[c.orderRef] ? cancelWhy[c.orderRef].label : null,
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

function Tile({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`card p-3 ${strong ? "border-volt/30" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-display ${strong ? "text-2xl text-volt" : "text-xl text-fg"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
