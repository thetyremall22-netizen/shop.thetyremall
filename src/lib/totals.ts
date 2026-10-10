// Server-safe totals calculation — mirrors the cart totals so the amount sent to
// PayFast is computed on the server and never trusted from the client.
import {
  FREE_DELIVERY_MIN_TYRES,
  STANDARD_DELIVERY_FEE,
  ROAD_HAZARD_FEE,
  ALIGNMENT_FEE,
  BALANCE_PER_TYRE,
  type DeliveryMethod,
} from "./shop-config";

export interface LineItem {
  id: number;
  slug: string;
  name: string;
  brand?: string;
  price: number; // minor units (cents)
  type: "tyre" | "wheel" | "other";
  qty: number;
  roadHazard?: boolean;
  alignment?: boolean;
  balanceQty?: number;
}

export interface OrderTotals {
  tyreQty: number;
  itemCount: number;
  subtotal: number;
  hazardTotal: number;
  alignmentTotal: number;
  balanceTotal: number;
  delivery: number;
  freeDelivery: boolean;
  total: number;
}

export function computeTotals(items: LineItem[], deliveryMethod: DeliveryMethod): OrderTotals {
  const tyreQty = items.filter((i) => i.type === "tyre").reduce((n, i) => n + i.qty, 0);
  const itemCount = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
  const hazardTotal = items.filter((i) => i.roadHazard).reduce((n, i) => n + ROAD_HAZARD_FEE * i.qty, 0);
  const alignmentTotal = items.filter((i) => i.alignment).reduce((n) => n + ALIGNMENT_FEE, 0);
  const balanceTotal = items.reduce((n, i) => n + (i.balanceQty ?? 0) * BALANCE_PER_TYRE, 0);
  const freeDelivery = tyreQty >= FREE_DELIVERY_MIN_TYRES;
  const delivery =
    deliveryMethod === "fitment" ? 0 : freeDelivery || itemCount === 0 ? 0 : STANDARD_DELIVERY_FEE;
  return {
    tyreQty,
    itemCount,
    subtotal,
    hazardTotal,
    alignmentTotal,
    balanceTotal,
    delivery,
    freeDelivery,
    total: subtotal + hazardTotal + alignmentTotal + balanceTotal + delivery,
  };
}
