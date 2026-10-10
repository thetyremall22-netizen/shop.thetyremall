/** Format minor units (ZAR cents) as e.g. "R4 229,00" — SA convention. */
export function formatPrice(minor: number): string {
  const rands = minor / 100;
  const [whole, dec] = rands.toFixed(2).split(".");
  const spaced = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `R${spaced},${dec}`;
}

/** Compact rands, no decimals: "R4 229" */
export function formatPriceShort(minor: number): string {
  const rands = Math.round(minor / 100);
  return `R${String(rands).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

export function discountPct(regular: number, sale: number): number {
  if (!regular || sale >= regular) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}
