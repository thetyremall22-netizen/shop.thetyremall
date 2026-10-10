"use client";

import { useCart, type CartItem } from "@/lib/cart";
import { Cart, Check } from "./icons";
import { useState } from "react";

export function QuickAddButton({
  item,
  className = "",
  label = "Add",
}: {
  item: Omit<CartItem, "qty" | "roadHazard">;
  className?: string;
  label?: string;
}) {
  const { add } = useCart();
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        add({ ...item, roadHazard: false });
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className={`btn ${done ? "btn-dark text-volt" : "btn-volt"} ${className}`}
      aria-label={`Add ${item.name} to cart`}
    >
      {done ? <Check width={16} height={16} /> : <Cart width={16} height={16} />}
      {done ? "Added" : label}
    </button>
  );
}
