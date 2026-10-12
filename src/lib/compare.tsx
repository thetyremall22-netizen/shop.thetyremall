"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./types";

// Just enough of a product to render the compare table + parse its spec.
export type CompareItem = Pick<
  Product,
  "id" | "slug" | "name" | "brand" | "type" | "price" | "regularPrice" |
  "salePrice" | "onSale" | "image" | "specs" | "categories" | "inStock" | "sku"
>;

export const COMPARE_MAX = 3;
const STORAGE_KEY = "ttm-compare-v1";

interface CompareContextValue {
  items: CompareItem[];
  has: (id: number) => boolean;
  isFull: boolean;
  toggle: (item: CompareItem) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items, hydrated]);

  const has = (id: number) => items.some((i) => i.id === id);
  const value: CompareContextValue = {
    items,
    has,
    isFull: items.length >= COMPARE_MAX,
    toggle: (item) =>
      setItems((cur) =>
        cur.some((i) => i.id === item.id)
          ? cur.filter((i) => i.id !== item.id)
          : cur.length >= COMPARE_MAX
            ? cur
            : [...cur, item]
      ),
    remove: (id) => setItems((cur) => cur.filter((i) => i.id !== id)),
    clear: () => setItems([]),
  };

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
