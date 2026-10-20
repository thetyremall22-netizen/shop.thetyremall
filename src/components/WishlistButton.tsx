"use client";

import { useAccount } from "@/lib/account-client";
import { Heart } from "./icons";

/** Save to / remove from the wishlist. Signed-out shoppers are taken to sign in
 *  (or register) and the item is saved straight after. */
export function WishlistButton({ slug, variant = "icon", className = "" }: { slug: string; variant?: "icon" | "text"; className?: string }) {
  const { has, toggle } = useAccount();
  const on = has(slug);
  const label = on ? "Saved to wishlist" : "Save to wishlist";
  if (variant === "text") {
    return (
      <button type="button" onClick={() => void toggle(slug)} aria-pressed={on} title={on ? "Remove from wishlist" : "Save to wishlist"}
        className={`inline-flex items-center gap-1.5 font-bold ${on ? "text-sale" : "text-muted hover:text-sale"} ${className}`}>
        <Heart width={16} height={16} fill={on ? "currentColor" : "none"} /> {label}
      </button>
    );
  }
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(slug); }} aria-pressed={on} aria-label={label} title={on ? "Remove from wishlist" : "Save to wishlist"}
      className={`grid size-9 place-items-center rounded-full bg-white/90 shadow ring-1 ring-black/10 transition hover:scale-110 ${on ? "text-sale" : "text-[#5c646d] hover:text-sale"} ${className}`}>
      <Heart width={18} height={18} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
