"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "./ConfirmDialog";
import { DealFields, blankDeal, dealToForm, formToDeal, dealSummaryText, type DealForm, type DealData } from "./DealFields";

interface CategoryDeal { id: number; kind: "special" | "sale"; name: string; slug: string; label: string; status: string }
const STATUS: Record<string, { text: string; badge: string }> = {
  live: { text: "Live now", badge: "badge-pay" }, scheduled: { text: "Starts later", badge: "badge-warn" },
  ended: { text: "Ended", badge: "badge-muted" }, draft: { text: "Switched off", badge: "badge-muted" },
};

/** A product's own deal (Buy X get Y free, % off, R off, deal price — with
 *  dates), plus the sale / special category deals it's already part of. */
export function ProductDealCard({ slug, canEdit }: { slug: string; canEdit: boolean }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [deal, setDeal] = useState<DealData | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [cats, setCats] = useState<CategoryDeal[]>([]);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<DealForm>(blankDeal);
  const [pending, setPending] = useState<"save" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const d = await fetch(`/api/admin/products/${encodeURIComponent(slug)}/deal`).then((r) => r.json()).catch(() => null);
    if (d) { setDeal(d.deal); setStatus(d.status); setCats(d.categoryDeals ?? []); }
    setLoaded(true);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function confirmYes() {
    if (!pending) return;
    setBusy(true); setMsg(null);
    const res = pending === "save"
      ? await fetch(`/api/admin/products/${encodeURIComponent(slug)}/deal`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formToDeal(f)) })
      : await fetch(`/api/admin/products/${encodeURIComponent(slug)}/deal`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusy(false); setPending(null);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save the deal." }); return; }
    setMsg({ ok: true, text: pending === "save" ? "✓ Deal saved — live on the site within a minute (from its start date)." : "✓ Deal removed." });
    setEditing(false);
    await load();
    router.refresh();
  }

  const st = status ? STATUS[status] : null;

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">Deal / offer</h2>
      <p className="mt-1 text-xs text-muted">
        A deal on this product only — e.g. Buy 3, get 1 free, 10% off, R200 off each, or a deal price — with optional start and end dates.
        It&apos;s applied in the cart, at checkout (PayFast / HappyPay amount), on the order and in the emails.
        To put many products on the same deal, tick them in the Products list and use the <b>Deal</b> action.
      </p>

      {!loaded ? <p className="mt-3 text-sm text-muted">Loading…</p> : (
        <>
          {deal && !editing && (
            <div className="mt-3 rounded-lg border border-volt/40 bg-volt/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm text-fg">🏷 {dealSummaryText(deal)}</b>
                {st && <span className={`badge ${st.badge}`}>{st.text}</span>}
              </div>
              {canEdit && (
                <div className="mt-2 flex gap-3 text-sm font-semibold">
                  <button type="button" onClick={() => { setF(dealToForm(deal)); setEditing(true); setMsg(null); }} className="text-volt hover:underline">✏️ Change</button>
                  <button type="button" onClick={() => setPending("remove")} className="text-muted hover:text-sale">Remove deal</button>
                </div>
              )}
            </div>
          )}
          {!deal && !editing && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">No deal on this product.</span>
              {canEdit && <button type="button" onClick={() => { setF(blankDeal); setEditing(true); setMsg(null); }} className="btn btn-volt h-9 px-4 text-sm">+ Add a deal</button>}
            </div>
          )}
          {editing && (
            <div className="mt-3">
              <DealFields f={f} set={setF} />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setEditing(false)} className="btn btn-dark h-9 px-4 text-sm">Cancel</button>
                <button type="button" onClick={() => setPending("save")} className="btn btn-volt h-9 px-4 text-sm">Save deal</button>
              </div>
            </div>
          )}

          {cats.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Also in these sale / special deals</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {cats.map((c) => (
                  <li key={c.slug} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/products/specials?${c.kind === "sale" ? "kind=sale&" : ""}open=${c.slug}`} className="font-semibold text-volt hover:underline">{c.name}</Link>
                    <span className="text-muted">{c.label}</span>
                    {STATUS[c.status] && <span className={`badge ${STATUS[c.status].badge}`}>{STATUS[c.status].text}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">When more than one deal is running, the customer gets whichever saves them more.</p>
            </div>
          )}
        </>
      )}
      {msg && <p className={`mt-3 text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}

      <ConfirmDialog open={!!pending} busy={busy} danger={pending === "remove"} onNo={() => setPending(null)} onYes={confirmYes}
        title={pending === "remove" ? "Remove the deal from this product?" : deal ? "Change this product's deal?" : "Add this deal to the product?"}
        yesLabel={pending === "remove" ? "Yes, remove it" : "Yes, save the deal"}>
        {pending === "save" && <p className="text-sm">{dealSummaryText(formToDeal(f))}</p>}
        {pending === "remove" && deal && <p className="text-sm">{dealSummaryText(deal)}</p>}
      </ConfirmDialog>
    </div>
  );
}
