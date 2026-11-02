import type { ProductDealInput } from "./product-deals";
import type { DealKind } from "./deals";

const n = (v: unknown, max: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0; };
const when = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

/** A deal from an admin request body (amounts and prices in cents). */
export function parseProductDeal(b: Record<string, unknown>): ProductDealInput {
  const kind = (["bxgy", "percent", "amount", "price"].includes(String(b.kind)) ? b.kind : "") as DealKind;
  return {
    kind, buy: n(b.buy, 100), get: n(b.get, 100), percent: n(b.percent, 100),
    amount: n(b.amount, 10_000_000), price: n(b.price, 100_000_000), limit: n(b.limit, 10_000) || null,
    label: typeof b.label === "string" ? b.label.trim().slice(0, 60) : "",
    startAt: when(b.startAt), endAt: when(b.endAt),
  };
}
