// Set-of-4 bulk pricing for tyres.
//
// Rule (from the client): buy 4 of the SAME tyre in one order and R200 comes
// off the set automatically. 1–3 of the same tyre are charged at the regular
// per-tyre price. Mag wheels are already sold as sets of 4, so they keep their
// single price and get no extra set discount.
//
// All amounts are in minor units (ZAR cents): R200 = 20000.

export const SET_OF_4_DISCOUNT = 20000; // R200,00
export const SET_QTY = 4;

/** Tyres show a per-tyre price and a set-of-4 price. Wheels do not. */
export function hasSetPricing(type: string): boolean {
  return type === "tyre";
}

/** Price for a set of 4 of one tyre: (unit × 4) − R200, never below zero. */
export function setPriceOf4(unitMinor: number): number {
  return Math.max(0, unitMinor * SET_QTY - SET_OF_4_DISCOUNT);
}

/**
 * Bulk saving applied in the cart for a single line: R200 for every complete
 * set of 4 of the same tyre (so 4 → −R200, 8 → −R400, 1–3 → R0). Capped so a
 * line can never go negative.
 */
export function setDiscountFor(unitMinor: number, qty: number, type: string): number {
  if (!hasSetPricing(type)) return 0;
  const sets = Math.floor(qty / SET_QTY);
  return Math.min(sets * SET_OF_4_DISCOUNT, unitMinor * qty);
}
