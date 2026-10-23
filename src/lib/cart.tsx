"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  FREE_DELIVERY_MIN_TYRES,
  STANDARD_DELIVERY_FEE,
  ROAD_HAZARD_FEE,
  ALIGNMENT_FEE,
  BALANCE_PER_TYRE,
  type DeliveryMethod,
} from "./shop-config";
import { setDiscountFor } from "./pricing";
import { canBuyNow, showGeoBlocked } from "@/components/GeoNotice";
import { trackTyrone } from "./tyrone-track";
import { trackAddToCart } from "./ecommerce-tracking";

export interface CartItem {
  id: number;
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  price: number; // minor units
  type: "tyre" | "wheel" | "other";
  qty: number;
  roadHazard: boolean;
  /** wheel-alignment add-on */
  alignment?: boolean;
  /** number of tyres to balance & valve (0–4) */
  balanceQty?: number;
}

interface CartState {
  items: CartItem[];
  deliveryMethod: DeliveryMethod;
  fitmentStoreId: string | null;
  fitmentDate: string | null;
}

type Action =
  | { type: "ADD"; item: Omit<CartItem, "qty">; qty: number }
  | { type: "SET_QTY"; id: number; qty: number }
  | { type: "REMOVE"; id: number }
  | { type: "TOGGLE_HAZARD"; id: number }
  | { type: "SET_DELIVERY"; method: DeliveryMethod }
  | { type: "SET_FITMENT"; storeId: string | null }
  | { type: "SET_FITMENT_DATE"; date: string | null }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; state: CartState };

const initial: CartState = {
  items: [],
  deliveryMethod: "delivery",
  fitmentStoreId: null,
  fitmentDate: null,
};

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.item.id
              ? { ...i, ...action.item, qty: i.qty + action.qty }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.item, qty: action.qty }] };
    }
    case "SET_QTY":
      return {
        ...state,
        items: state.items
          .map((i) => (i.id === action.id ? { ...i, qty: Math.max(1, action.qty) } : i))
          .filter((i) => i.qty > 0),
      };
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "TOGGLE_HAZARD":
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, roadHazard: !i.roadHazard } : i
        ),
      };
    case "SET_DELIVERY":
      return { ...state, deliveryMethod: action.method };
    case "SET_FITMENT":
      return { ...state, fitmentStoreId: action.storeId };
    case "SET_FITMENT_DATE":
      return { ...state, fitmentDate: action.date };
    case "CLEAR":
      return initial;
    case "HYDRATE":
      return action.state;
    default:
      return state;
  }
}

export interface CartTotals {
  tyreQty: number;
  itemCount: number;
  subtotal: number;
  setDiscount: number;
  hazardTotal: number;
  alignmentTotal: number;
  balanceTotal: number;
  delivery: number;
  freeDelivery: boolean;
  tyresToFreeDelivery: number;
  total: number;
}

interface CartContextValue extends CartState {
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  toggleHazard: (id: number) => void;
  setDelivery: (method: DeliveryMethod) => void;
  setFitment: (storeId: string | null) => void;
  setFitmentDate: (date: string | null) => void;
  clear: () => void;
  totals: CartTotals;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ttm-cart-v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", state: { ...initial, ...JSON.parse(raw) } });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, hydrated]);

  const totals = useMemo<CartTotals>(() => {
    const tyreQty = state.items
      .filter((i) => i.type === "tyre")
      .reduce((n, i) => n + i.qty, 0);
    const itemCount = state.items.reduce((n, i) => n + i.qty, 0);
    const subtotal = state.items.reduce((n, i) => n + i.price * i.qty, 0);
    const setDiscount = state.items.reduce((n, i) => n + setDiscountFor(i.price, i.qty, i.type), 0);
    const hazardTotal = state.items
      .filter((i) => i.roadHazard)
      .reduce((n, i) => n + ROAD_HAZARD_FEE * i.qty, 0);
    const alignmentTotal = state.items
      .filter((i) => i.alignment)
      .reduce((n) => n + ALIGNMENT_FEE, 0);
    const balanceTotal = state.items.reduce(
      (n, i) => n + (i.balanceQty ?? 0) * BALANCE_PER_TYRE,
      0
    );
    const freeDelivery = tyreQty >= FREE_DELIVERY_MIN_TYRES;
    const delivery =
      state.deliveryMethod === "fitment"
        ? 0
        : freeDelivery || itemCount === 0
          ? 0
          : STANDARD_DELIVERY_FEE;
    const tyresToFreeDelivery = Math.max(0, FREE_DELIVERY_MIN_TYRES - tyreQty);
    return {
      tyreQty,
      itemCount,
      subtotal,
      setDiscount,
      hazardTotal,
      alignmentTotal,
      balanceTotal,
      delivery,
      freeDelivery,
      tyresToFreeDelivery,
      total: subtotal - setDiscount + hazardTotal + alignmentTotal + balanceTotal + delivery,
    };
  }, [state]);

  const value: CartContextValue = {
    ...state,
    add: (item, qty = 1) => {
      // Outside South Africa: browsing only (the server refuses checkout too).
      if (!canBuyNow()) { showGeoBlocked(); return; }
      trackTyrone("add_to_cart", { label: `${qty}× ${item.name}`, href: `/product/${item.slug}` });
      trackAddToCart(item, qty);
      dispatch({ type: "ADD", item, qty });
      setDrawerOpen(true);
    },
    setQty: (id, qty) => dispatch({ type: "SET_QTY", id, qty }),
    remove: (id) => dispatch({ type: "REMOVE", id }),
    toggleHazard: (id) => dispatch({ type: "TOGGLE_HAZARD", id }),
    setDelivery: (method) => dispatch({ type: "SET_DELIVERY", method }),
    setFitment: (storeId) => dispatch({ type: "SET_FITMENT", storeId }),
    setFitmentDate: (date) => dispatch({ type: "SET_FITMENT_DATE", date }),
    // Remove the persisted cart FIRST, then clear state. On the order-success
    // page the provider re-mounts and its hydrate effect runs *after* this call;
    // nuking localStorage here means that hydrate finds nothing to restore, so
    // the cart genuinely empties (and can't come back from a stale copy).
    clear: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
      dispatch({ type: "CLEAR" });
    },
    totals,
    drawerOpen,
    setDrawerOpen,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
