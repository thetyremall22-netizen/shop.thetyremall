"use client";

import { useCompare, type CompareItem } from "@/lib/compare";
import { Check } from "./icons";

export function CompareToggle({ item, dark = false, labelAdd = "Compare", className = "" }: { item: CompareItem; dark?: boolean; labelAdd?: string; className?: string }) {
  const { has, isFull, toggle } = useCompare();
  const checked = has(item.id);
  const disabled = !checked && isFull;

  const text = disabled
    ? (dark ? "cursor-not-allowed text-faint" : "cursor-not-allowed text-[#b5bac1]")
    : (dark ? "text-muted hover:text-volt" : "text-[#5c646d] hover:text-[#4f7000]");
  const box = checked
    ? (dark ? "border-volt bg-volt" : "border-[#4f7000] bg-[#4f7000]")
    : (dark ? "border-line-2" : "border-black/25");

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) toggle(item); }}
      disabled={disabled}
      aria-pressed={checked}
      title={disabled ? "Compare up to 3 tyres — remove one first" : "Add to compare"}
      className={`inline-flex items-center gap-1.5 font-bold ${text} ${className}`}
    >
      <span className={`grid size-4 shrink-0 place-items-center rounded border ${box}`}>
        {checked && <Check width={11} height={11} className={dark ? "text-volt-ink" : "text-white"} />}
      </span>
      {checked ? "Added to compare" : labelAdd}
    </button>
  );
}
