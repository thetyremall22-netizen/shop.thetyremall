"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UndoBar } from "./ConfirmDialog";

export interface AdminProductRow {
  slug: string;
  name: string;
  brand: string;
  sku: string;
  price: number;
  regularPrice: number;
  salePrice: number;
  onSale: boolean;
  stockQty: number;
  lowStockThreshold: number;
}

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

type ActionKind = "price" | "stock" | "status" | "sale";

export function ProductsTable({ rows, q, filter, type, total, sort = "stock_desc", sortLinks = {} }: {
  rows: AdminProductRow[]; q: string; filter: string; type?: string; total: number;
  /** Current sort, and a link for each sort option (built by the page). */
  sort?: string; sortLinks?: Record<string, string>;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [applyAll, setApplyAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [undo, setUndo] = useState<{ id: number; message: string } | null>(null);

  // action builder
  const [kind, setKind] = useState<ActionKind>("price");
  const [priceMode, setPriceMode] = useState("pct_down");
  const [priceVal, setPriceVal] = useState("10");
  const [rounding, setRounding] = useState("none");
  const [stockMode, setStockMode] = useState("set");
  const [stockVal, setStockVal] = useState("0");
  const [visible, setVisible] = useState("true");
  const [saleMode, setSaleMode] = useState("set");
  const [salePct, setSalePct] = useState("10");

  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.slug));
  const active = applyAll || sel.size > 0;
  const affected = applyAll ? total : sel.size;

  function toggle(slug: string) {
    setApplyAll(false);
    setSel((prev) => { const n = new Set(prev); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });
  }
  function toggleAllPage() {
    setApplyAll(false);
    setSel((prev) => (allOnPage ? new Set() : new Set(rows.map((r) => r.slug))));
  }

  const opLabel = useMemo(() => {
    if (kind === "price") {
      const m: Record<string, string> = { pct_down: `reduce price by ${priceVal}%`, pct_up: `increase price by ${priceVal}%`, rand_down: `reduce price by R${priceVal}`, rand_up: `increase price by R${priceVal}`, set: `set price to R${priceVal}` };
      return m[priceMode];
    }
    if (kind === "stock") { const m: Record<string, string> = { set: `set stock to ${stockVal}`, inc: `increase stock by ${stockVal}`, dec: `decrease stock by ${stockVal}` }; return m[stockMode]; }
    if (kind === "status") return visible === "true" ? "show in shop" : "hide from shop";
    return saleMode === "remove" ? "remove sale" : `put on sale (${salePct}% off)`;
  }, [kind, priceMode, priceVal, stockMode, stockVal, visible, saleMode, salePct]);

  function buildOp() {
    if (kind === "price") return { kind, mode: priceMode, value: Number(priceVal) || 0, rounding };
    if (kind === "stock") return { kind, mode: stockMode, value: Number(stockVal) || 0 };
    if (kind === "status") return { kind, visible: visible === "true" };
    return saleMode === "remove" ? { kind, mode: "remove" } : { kind, mode: "set", pct: Number(salePct) || 0 };
  }

  async function apply() {
    if (busy || !active) return;
    if (!confirming) { setConfirming(true); setMsg(null); return; }
    setConfirming(false);
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applyAll ? { scope: "filter", q, filter, type, op: buildOp(), label: opLabel } : { scope: "selected", slugs: [...sel], op: buildOp(), label: opLabel }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`✓ Updated ${d.updated} product${d.updated === 1 ? "" : "s"} — live within ~1 min.`);
        if (d.auditId) setUndo({ id: d.auditId, message: `${opLabel} on ${d.updated} product${d.updated === 1 ? "" : "s"}` });
        setSel(new Set()); setApplyAll(false); router.refresh();
      }
      else setMsg(d.error ?? "Bulk update failed.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  const inp = "h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-fg outline-none focus:border-volt";

  return (
    <div>
      {active && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-volt/40 bg-ink-2/95 p-3 shadow-lg shadow-black/40 backdrop-blur">
          <span className="text-sm font-bold text-volt">{affected.toLocaleString()} selected</span>
          {!applyAll && total > rows.length && (
            <button onClick={() => { setApplyAll(true); }} className="text-xs font-semibold text-muted underline hover:text-fg">Select all {total.toLocaleString()} matching</button>
          )}
          {applyAll && <button onClick={() => { setApplyAll(false); setSel(new Set()); }} className="text-xs font-semibold text-muted underline hover:text-fg">Clear</button>}

          <span className="mx-1 h-5 w-px bg-line" />

          <select value={kind} onChange={(e) => setKind(e.target.value as ActionKind)} className={inp}>
            <option value="price">Price</option>
            <option value="stock">Stock</option>
            <option value="status">Visibility</option>
            <option value="sale">Sale</option>
          </select>

          {kind === "price" && (
            <>
              <select value={priceMode} onChange={(e) => setPriceMode(e.target.value)} className={inp}>
                <option value="pct_down">Reduce by %</option>
                <option value="pct_up">Increase by %</option>
                <option value="rand_down">Reduce by R</option>
                <option value="rand_up">Increase by R</option>
                <option value="set">Set to R</option>
              </select>
              <input type="number" min={0} value={priceVal} onChange={(e) => setPriceVal(e.target.value)} className={`${inp} w-20`} />
              <select value={rounding} onChange={(e) => setRounding(e.target.value)} className={inp} title="Rounding">
                <option value="none">No rounding</option>
                <option value="r99">End in 99</option>
                <option value="r10">Nearest R10</option>
                <option value="r50">Nearest R50</option>
              </select>
            </>
          )}
          {kind === "stock" && (
            <>
              <select value={stockMode} onChange={(e) => setStockMode(e.target.value)} className={inp}>
                <option value="set">Set to</option>
                <option value="inc">Increase by</option>
                <option value="dec">Decrease by</option>
              </select>
              <input type="number" min={0} value={stockVal} onChange={(e) => setStockVal(e.target.value)} className={`${inp} w-20`} />
            </>
          )}
          {kind === "status" && (
            <select value={visible} onChange={(e) => setVisible(e.target.value)} className={inp}>
              <option value="true">Show in shop</option>
              <option value="false">Hide from shop</option>
            </select>
          )}
          {kind === "sale" && (
            <>
              <select value={saleMode} onChange={(e) => setSaleMode(e.target.value)} className={inp}>
                <option value="set">Put on sale (% off)</option>
                <option value="remove">Remove sale</option>
              </select>
              {saleMode === "set" && <input type="number" min={1} max={95} value={salePct} onChange={(e) => setSalePct(e.target.value)} className={`${inp} w-20`} />}
            </>
          )}

          {confirming ? (
            <>
              <button onClick={apply} disabled={busy} className="btn btn-volt h-9 px-4 text-sm disabled:opacity-50">{busy ? "Applying…" : `Confirm: ${opLabel} on ${affected.toLocaleString()}`}</button>
              <button onClick={() => setConfirming(false)} className="text-xs font-semibold text-muted hover:text-fg">Cancel</button>
            </>
          ) : (
            <button onClick={apply} disabled={busy} className="btn btn-volt h-9 px-4 text-sm disabled:opacity-50">Apply</button>
          )}
          {msg && <span className={`text-xs font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
        </div>
      )}
      {!active && msg && <div className="mb-3 text-xs font-semibold text-pay">{msg}</div>}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allOnPage} onChange={toggleAllPage} className="size-4 accent-volt" aria-label="Select all on page" /></th>
              <th className="px-4 py-2.5"><SortHeader label="Product" asc="name" desc="name_desc" first="asc" sort={sort} links={sortLinks} /></th>
              <th className="px-4 py-2.5"><SortHeader label="Price" asc="price_asc" desc="price_desc" sort={sort} links={sortLinks} /></th>
              <th className="px-4 py-2.5"><SortHeader label="Stock" asc="stock_asc" desc="stock_desc" sort={sort} links={sortLinks} /></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const low = p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
              const checked = applyAll || sel.has(p.slug);
              return (
                <tr key={p.slug} className={`border-b border-line last:border-0 ${checked ? "bg-volt/5" : ""}`}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={checked} disabled={applyAll} onChange={() => toggle(p.slug)} className="size-4 accent-volt" aria-label={`Select ${p.name}`} /></td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-fg">{p.name}</div>
                    <div className="text-xs text-muted">{p.brand} · {p.sku || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {p.onSale ? <><span className="text-faint line-through">{zar(p.regularPrice)}</span> <span className="font-semibold text-fg">{zar(p.salePrice)}</span></> : <span className="font-semibold text-fg">{zar(p.price)}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.stockQty === 0
                      ? <span className="font-semibold text-sale">Out</span>
                      : <span className={`font-semibold ${low ? "text-amber-400" : "text-pay"}`}>{p.stockQty}{low ? " · low" : ""}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/products/${p.slug}`} className="text-sm font-bold text-volt hover:underline">Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {undo && (
        <UndoBar message={undo.message} seconds={60} onClose={() => setUndo(null)}
          onUndo={async () => {
            const res = await fetch("/api/admin/products/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "undo", auditId: undo.id }) });
            const d = await res.json().catch(() => ({}));
            setMsg(res.ok ? `↩ Undone — ${d.restored} product${d.restored === 1 ? "" : "s"} put back.` : d.error ?? "Couldn't undo.");
            router.refresh();
          }} />
      )}
    </div>
  );
}

/** Clickable column header: first click sorts (highest first for numbers),
 *  clicking again flips the direction. */
function SortHeader({ label, asc, desc, first = "desc", sort, links }: { label: string; asc: string; desc: string; first?: "asc" | "desc"; sort: string; links: Record<string, string> }) {
  const active = sort === asc || sort === desc;
  const next = active ? (sort === desc ? asc : desc) : first === "asc" ? asc : desc;
  const arrow = !active ? "↕" : sort === desc ? "↓" : "↑";
  const href = links[next];
  if (!href) return <>{label}</>;
  return (
    <Link href={href} className={`inline-flex items-center gap-1 uppercase hover:text-volt ${active ? "text-volt" : ""}`}
      title={next === desc ? (label === "Product" ? "Sort Z–A" : "Sort highest first") : (label === "Product" ? "Sort A–Z" : "Sort lowest first")}>
      {label} <span aria-hidden>{arrow}</span>
    </Link>
  );
}
