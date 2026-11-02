"use client";

import { dealLabel, type DealKind } from "@/lib/deals";

// The deal settings form shared by a product's "Deal / offer" box and the
// products list's bulk "Deal" action.

export interface DealForm { preset: string; buy: string; get: string; percent: string; amount: string; price: string; limit: string; label: string; start: string; end: string }
export const blankDeal: DealForm = { preset: "b3g1", buy: "", get: "", percent: "", amount: "", price: "", limit: "", label: "", start: "", end: "" };

const PRESETS: { v: string; label: string; kind: DealKind; buy?: number; get?: number; percent?: number }[] = [
  { v: "b1g1", label: "Buy 1, get 1 free", kind: "bxgy", buy: 1, get: 1 },
  { v: "b2g2", label: "Buy 2, get 2 free", kind: "bxgy", buy: 2, get: 2 },
  { v: "b3g1", label: "Buy 3, get 1 free", kind: "bxgy", buy: 3, get: 1 },
  { v: "bxgy", label: "Buy X, get Y free (choose the numbers)", kind: "bxgy" },
  { v: "p10", label: "10% off", kind: "percent", percent: 10 },
  { v: "p50", label: "50% off", kind: "percent", percent: 50 },
  { v: "p100", label: "100% off (free)", kind: "percent", percent: 100 },
  { v: "pct", label: "% off (choose the %)", kind: "percent" },
  { v: "amount", label: "Rand off each item (choose the amount)", kind: "amount" },
  { v: "price", label: "Deal price for each item (choose the price)", kind: "price" },
];

const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const lab = "mb-1 block text-xs font-semibold text-muted";
/** ms → <input type="datetime-local"> value in the viewer's time zone. */
const toLocal = (ms: number | null) => { if (!ms) return ""; const d = new Date(ms); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).getTime() : null);
const cents = (v: string) => Math.round((parseFloat(v.replace(",", ".")) || 0) * 100);

export interface DealData { kind: DealKind; buy: number; get: number; percent: number; amount: number; price: number; limit: number | null; label: string; startAt: number | null; endAt: number | null }

export function dealToForm(d: DealData): DealForm {
  const preset = d.kind === "amount" ? "amount" : d.kind === "price" ? "price"
    : PRESETS.find((p) => p.kind === d.kind && p.v !== "bxgy" && p.v !== "pct" && ((p.buy === d.buy && p.get === d.get) || (p.percent != null && p.percent === d.percent)))?.v
      ?? (d.kind === "bxgy" ? "bxgy" : "pct");
  return {
    preset, buy: d.buy ? String(d.buy) : "", get: d.get ? String(d.get) : "", percent: d.percent ? String(d.percent) : "",
    amount: d.amount ? String(d.amount / 100) : "", price: d.price ? String(d.price / 100) : "", limit: d.limit ? String(d.limit) : "",
    label: d.label, start: toLocal(d.startAt), end: toLocal(d.endAt),
  };
}

/** Form → request body (amounts and prices in cents). */
export function formToDeal(f: DealForm): DealData {
  const p = PRESETS.find((x) => x.v === f.preset) ?? PRESETS[2];
  return {
    kind: p.kind, buy: p.buy ?? Number(f.buy || 0), get: p.get ?? Number(f.get || 0), percent: p.percent ?? Number(f.percent || 0),
    amount: p.kind === "amount" ? cents(f.amount) : 0, price: p.kind === "price" ? cents(f.price) : 0,
    limit: Number(f.limit || 0) || null, label: f.label.trim(), startAt: fromLocal(f.start), endAt: fromLocal(f.end),
  };
}

/** "Weekend Special — Buy 3, get 1 free · max 4 per order · 1 Nov → 30 Nov". */
export function dealSummaryText(d: DealData): string {
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  return [`${d.label || "Special offer"} — ${dealLabel(d)}`, d.limit ? `max ${d.limit} per order` : "", d.startAt || d.endAt ? `${d.startAt ? day(d.startAt) : "now"} → ${d.endAt ? day(d.endAt) : "no end"}` : ""].filter(Boolean).join(" · ");
}

export function DealFields({ f, set }: { f: DealForm; set: (f: DealForm) => void }) {
  const kind = (PRESETS.find((p) => p.v === f.preset) ?? PRESETS[2]).kind;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={lab}>Deal type</span>
          <select className={field} value={f.preset} onChange={(e) => set({ ...f, preset: e.target.value, ...(e.target.value === "p100" && !f.limit ? { limit: "4" } : {}) })}>
            {PRESETS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select></label>
        <label><span className={lab}>Name shown to customers (optional)</span>
          <input className={field} value={f.label} placeholder="e.g. Weekend Special" maxLength={60} onChange={(e) => set({ ...f, label: e.target.value })} /></label>
        {f.preset === "bxgy" && (<>
          <label><span className={lab}>Buy how many</span><input type="number" min={1} className={field} value={f.buy} onChange={(e) => set({ ...f, buy: e.target.value })} /></label>
          <label><span className={lab}>Get how many free</span><input type="number" min={1} className={field} value={f.get} onChange={(e) => set({ ...f, get: e.target.value })} /></label>
        </>)}
        {f.preset === "pct" && <label><span className={lab}>% off</span><input type="number" min={1} max={100} className={field} value={f.percent} onChange={(e) => set({ ...f, percent: e.target.value })} /></label>}
        {f.preset === "amount" && <label><span className={lab}>Rand off each item</span><input type="number" min={1} step="0.01" className={field} value={f.amount} placeholder="e.g. 200" onChange={(e) => set({ ...f, amount: e.target.value })} /></label>}
        {f.preset === "price" && <label><span className={lab}>Deal price for each item (R)</span><input type="number" min={1} step="0.01" className={field} value={f.price} placeholder="e.g. 1999" onChange={(e) => set({ ...f, price: e.target.value })} /></label>}
        <label><span className={lab}>Limit per order (optional{f.preset === "p100" ? " — required for free deals" : ""})</span>
          <input type="number" min={1} className={field} value={f.limit} placeholder="No limit" onChange={(e) => set({ ...f, limit: e.target.value })} /></label>
        <span />
        <label><span className={lab}>Starts (optional — blank = straight away)</span>
          <input type="datetime-local" className={field} value={f.start} onChange={(e) => set({ ...f, start: e.target.value })} /></label>
        <label><span className={lab}>Ends (optional — blank = no end)</span>
          <input type="datetime-local" className={field} value={f.end} onChange={(e) => set({ ...f, end: e.target.value })} /></label>
      </div>
      <p className="text-xs text-muted">
        {kind === "bxgy"
          ? "Counts the same product only (e.g. 4 of the same tyre on Buy 3, get 1 free = 1 free)."
          : "The lower price shows on the product and in the cart."}{" "}
        Taken off in the cart, at checkout (PayFast / HappyPay amount), on the order, invoice and emails. Replaces the set-of-4 saving; coupons don&apos;t apply to it.
        If the product is also in a sale / special category with a deal, the customer gets whichever saves more — never both. “Limit per order” = the most items one order gets free or discounted.
      </p>
    </div>
  );
}
