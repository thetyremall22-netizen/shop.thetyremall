// Deal rules for special / sale categories (Admin → Products → Special
// categories → Deal type): "Buy 3, get 1 free", "10% off", "100% off"…
// Pure and shared: the cart (browser) and checkout (server) use the same
// maths, so the amount the customer sees is the amount charged.
//
// Rules agreed with the shop:
//  • Buy X get Y counts the SAME product only (same tyre, same brand) — one
//    cart line — e.g. 4 × the same tyre on "Buy 3, get 1 free" = 1 free.
//  • A deal replaces the set-of-4 saving on that product.
//  • Coupons don't apply to products that have a live deal.
//  • A product in two live deals gets the better one, never both.
//  • "Limit per order" caps how many items one order gets free / discounted
//    under that deal (required for 100% off).

/** bxgy = buy X get Y free · percent = % off · amount = R off each · price = a set deal price each */
export type DealKind = "bxgy" | "percent" | "amount" | "price";

export interface Deal {
  /** Who gives the deal: a special / sale category's address (e.g. "black-friday-2026"),
   *  or "product:<slug>" for a deal set on one product. */
  slug: string;
  /** Shown to customers (e.g. "Black Friday 2026", "Weekend Special"). */
  name: string;
  kind: DealKind;
  buy: number;      // bxgy: buy this many…
  get: number;      // …get this many free
  percent: number;  // percent: % off (1–100)
  amount?: number;  // amount: cents off each item
  price?: number;   // price: deal price for each item (cents)
  /** Most items per order that get the deal (free / discounted); null = no limit. */
  limit: number | null;
}

const rands = (c: number) => `R${(c / 100).toLocaleString("en-ZA", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** "Buy 3, get 1 free" · "10% off" · "Free" · "R200 off each" · "Deal price R1,999". */
export function dealLabel(d: Pick<Deal, "kind" | "buy" | "get" | "percent" | "amount" | "price">): string {
  if (d.kind === "percent") return d.percent >= 100 ? "Free" : `${d.percent}% off`;
  if (d.kind === "amount") return `${rands(d.amount ?? 0)} off each`;
  if (d.kind === "price") return `Deal price ${rands(d.price ?? 0)}`;
  return `Buy ${d.buy}, get ${d.get} free`;
}

/** How many items (of `qty`) are free / discounted, before the per-order limit. */
function dealUnits(qty: number, d: Deal): number {
  if (d.kind !== "bxgy") return qty;
  const group = d.buy + d.get;
  return group > 0 ? Math.floor(qty / group) * d.get : 0;
}

/** Saving on one item (cents) under a deal. */
function unitSaving(unit: number, d: Deal): number {
  if (d.kind === "percent") return Math.round((unit * Math.min(100, Math.max(0, d.percent))) / 100);
  if (d.kind === "amount") return Math.min(unit, Math.max(0, d.amount ?? 0));
  if (d.kind === "price") return Math.max(0, unit - Math.max(0, d.price ?? unit));
  return unit;
}

/** Price of one item under a % off / R off / deal-price deal (for product cards / pages). */
export function dealPrice(unit: number, d: Deal): number {
  return d.kind === "bxgy" ? unit : Math.max(0, unit - unitSaving(unit, d));
}

/** The better of a product's live deals (most saving at this quantity, else
 *  at a full deal quantity), or null. */
export function bestDeal(deals: Deal[] | undefined, unit: number, qty = 0): Deal | null {
  if (!deals?.length) return null;
  const score = (d: Deal) => {
    const q = qty || (d.kind === "bxgy" ? d.buy + d.get : 1);
    const units = d.limit != null ? Math.min(dealUnits(q, d), d.limit) : dealUnits(q, d);
    return units * unitSaving(unit, d);
  };
  return [...deals].sort((a, b) => score(b) - score(a))[0];
}

export interface DealLine { slug: string; price: number; qty: number; deals?: Deal[] }
export interface AppliedDeal {
  slug: string;        // product
  deal: Deal;
  units: number;       // items free / discounted
  saving: number;      // cents
  label: string;       // "Black Friday 2026 — Buy 3, get 1 free"
}

/** Work out every line's deal saving, honouring each deal's per-order limit. */
export function applyDeals(lines: DealLine[]): { applied: AppliedDeal[]; total: number; dealSlugs: Set<string> } {
  const used = new Map<string, number>(); // deal slug → units already given in this order
  const applied: AppliedDeal[] = [];
  const dealSlugs = new Set<string>();    // products with a live deal (no set-of-4 saving, no coupon)
  for (const l of lines) {
    const d = bestDeal(l.deals, l.price, l.qty);
    if (!d) continue;
    dealSlugs.add(l.slug);
    let units = dealUnits(l.qty, d);
    if (d.limit != null) units = Math.min(units, Math.max(0, d.limit - (used.get(d.slug) ?? 0)));
    if (units <= 0) continue;
    used.set(d.slug, (used.get(d.slug) ?? 0) + units);
    applied.push({ slug: l.slug, deal: d, units, saving: units * unitSaving(l.price, d), label: `${d.name} — ${dealLabel(d)}` });
  }
  return { applied, total: applied.reduce((n, a) => n + a.saving, 0), dealSlugs };
}

/** What `qty` of one product costs under a deal (e.g. a set of 4 on Buy 3, get 1 free = 3 × price). */
export function priceForQty(unit: number, qty: number, d: Deal): number {
  return unit * qty - applyDeals([{ slug: "_", price: unit, qty, deals: [d] }]).total;
}

/** Hint for the cart line: "Add 1 more to get 1 free". */
export function dealHint(qty: number, d: Deal): string | null {
  if (d.kind !== "bxgy") return null;
  const group = d.buy + d.get;
  const short = group - (qty % group);
  if (qty % group === 0 || short <= 0) return null;
  return `Add ${short} more to get ${d.get} free`;
}
