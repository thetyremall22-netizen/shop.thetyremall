"use client";

import { useRouter } from "next/navigation";
import { Close } from "./icons";
import type { Category } from "@/lib/types";

const LABELS: Record<string, string> = {
  width: "Width", profile: "Profile", rim: "Rim", pcd: "PCD",
  min: "Min", max: "Max",
};

export function ActiveFilterChips({ search, categories }: { search: string; categories: Category[] }) {
  const router = useRouter();
  const params = new URLSearchParams(search);

  const chips: { key: string; label: string }[] = [];
  const cat = params.get("category");
  const type = params.get("type");
  const q = params.get("q");

  if (q) chips.push({ key: "q", label: `“${q}”` });
  if (type === "wheel") chips.push({ key: "type", label: "Mag Wheels" });
  if (cat) chips.push({ key: "category", label: categories.find((c) => c.slug === cat)?.name ?? cat });
  if (params.get("brand")) chips.push({ key: "brand", label: params.get("brand")! });
  for (const k of ["width", "profile", "rim", "pcd"]) {
    if (params.get(k)) chips.push({ key: k, label: `${LABELS[k]}: ${params.get(k)}` });
  }
  if (params.get("runflat") === "1") chips.push({ key: "runflat", label: "Run-flat" });
  if (params.get("xl") === "1") chips.push({ key: "xl", label: "Extra load" });
  if (params.get("min")) chips.push({ key: "min", label: `Min R${params.get("min")}` });
  if (params.get("max")) chips.push({ key: "max", label: `Max R${params.get("max")}` });
  if (params.get("onSale") === "1") chips.push({ key: "onSale", label: "On sale" });

  if (chips.length === 0) return null;

  const remove = (key: string) => {
    const next = new URLSearchParams(search);
    next.delete(key);
    next.delete("page");
    router.push(next.toString() ? `/shop?${next.toString()}` : "/shop", { scroll: false });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => remove(c.key)}
          className="inline-flex items-center gap-1.5 rounded-full border border-volt/40 bg-volt/10 px-3 py-1 text-xs font-semibold text-fg hover:border-volt"
        >
          {c.label}
          <Close width={12} height={12} className="text-muted" />
        </button>
      ))}
      {chips.length > 1 && (
        <button onClick={() => router.push("/shop", { scroll: false })} className="text-xs font-bold text-faint hover:text-sale">
          Clear all
        </button>
      )}
    </div>
  );
}
