"use client";

import { useEffect } from "react";
import { trackViewItem, type TrackItem } from "@/lib/ecommerce-tracking";

/** Tells Google Analytics / Ads which product was viewed (for remarketing). */
export function TrackViewItem({ item }: { item: TrackItem }) {
  useEffect(() => { trackViewItem(item); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
