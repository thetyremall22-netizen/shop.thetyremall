"use client";

import { useCompare, type CompareItem } from "@/lib/compare";
import { Check } from "./icons";

export function CompareToggle({ item }: { item: CompareItem }) {
  const { has, isFull, toggle } = useCompare();
  const checked = has(item.id);
  const disabled = !checked && isFull;

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) toggle(item); }}
      disabled={disabled}
      aria-pressed={checked}
      title={disabled ? "Compare up to 3 tyres — remove one first" : "Add to compare"}
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${disabled ? "cursor-not-allowed text-[#b5bac1]" : "text-[#5c646d] hover:text-[#4f7000]"}`}
    >
      <span className={`grid size-4 place-items-center rounded border ${checked ? "border-[#4f7000] bg-[#4f7000]" : "border-black/25"}`}>
        {checked && <Check width={11} height={11} className="text-white" />}
      </span>
      Compare
    </button>
  );
}
