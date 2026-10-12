"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "./icons";

const OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
];

export function SortSelect({ search }: { search: string }) {
  const router = useRouter();
  const params = new URLSearchParams(search);
  const value = params.get("sort") ?? "relevance";

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(search);
          if (e.target.value === "relevance") next.delete("sort");
          else next.set("sort", e.target.value);
          next.delete("page");
          router.push(`/shop?${next.toString()}`, { scroll: false });
        }}
        className="h-10 appearance-none rounded-lg border border-line bg-surface-2 pl-3 pr-9 text-sm font-semibold text-fg outline-none focus:border-volt"
      >
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
    </div>
  );
}
