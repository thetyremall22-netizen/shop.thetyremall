"use client";

import { useCart, type CartItem } from "@/lib/cart";
import { setDiscountFor } from "@/lib/pricing";
import { bestDeal, dealHint, dealLabel } from "@/lib/deals";
import { formatPrice } from "@/lib/format";
import { Check } from "./icons";

/** Under a cart line: its deal saving ("Black Friday — Buy 3, get 1 free · save R…"),
 *  a nudge ("Add 1 more to get 1 free"), or the set-of-4 saving. */
export function CartLineSaving({ item, className = "mt-1.5" }: { item: CartItem; className?: string }) {
  const { totals, deals } = useCart();
  const pill = `${className} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold`;
  const applied = totals.dealLines.find((d) => d.slug === item.slug);
  if (applied) return <div className={`${pill} bg-volt/15 text-volt`}><Check width={12} height={12} /> {applied.label} — save {formatPrice(applied.saving)}</div>;
  const deal = bestDeal(deals[item.slug], item.price, item.qty);
  if (deal) {
    const hint = dealHint(item.qty, deal);
    return <div className={`${pill} bg-amber-400/15 text-amber-300`}>🏷 {deal.name}: {hint ?? dealLabel(deal)}</div>;
  }
  const set = setDiscountFor(item.price, item.qty, item.type);
  return set > 0 ? <div className={`${pill} bg-volt/15 text-volt`}><Check width={12} height={12} /> Set of 4 — save {formatPrice(set)}</div> : null;
}
