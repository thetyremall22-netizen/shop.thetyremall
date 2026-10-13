"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Close, Filter, ChevronDown } from "./icons";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  brands: { name: string; count: number }[];
  widths: string[];
  profiles: string[];
  rims: string[];
  total: number;
  search: string;
}

export function ShopFilters(props: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      {/* mobile-only trigger — wrapped so .btn's own display can't override lg:hidden */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="btn btn-dark w-full"
        >
          <Filter width={16} height={16} /> Filters
        </button>
      </div>

      <div className="hidden lg:block">
        <FilterBody {...props} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm overflow-y-auto bg-ink-2 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg">Filters</h2>
              <button onClick={() => setMobileOpen(false)} aria-label="Close"><Close /></button>
            </div>
            <FilterBody {...props} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function FilterBody({
  categories,
  brands,
  widths,
  profiles,
  rims,
  search,
  onNavigate,
}: Props & { onNavigate?: () => void }) {
  const router = useRouter();
  const params = new URLSearchParams(search);

  // Apply several param changes in ONE navigation (avoids the stale-search race
  // you get when calling setParam twice in a row).
  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }
      next.delete("page");
      // Apply the filter, then bring the page back to the top so the results
      // (and the banner/heading) always start from the top — never left
      // scrolled down past the end of a short result set.
      router.push(`/shop?${next.toString()}`, { scroll: false });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      onNavigate?.();
    },
    [search, router, onNavigate]
  );
  const setParam = useCallback((key: string, value: string | null) => setParams({ [key]: value }), [setParams]);

  const current = (k: string) => params.get(k) ?? "";
  const activeCount = ["category", "brand", "width", "profile", "rim", "type", "onSale", "q", "runflat", "xl", "min", "max"].filter((k) => params.get(k)).length;
  const priceActive = (min: string, max: string) => current("min") === min && current("max") === max;

  return (
    <div className="space-y-5">
      {/* Constant-height header so toggling "Clear all" never pushes the
          category list up/down — the Clear control swaps in/out on the right. */}
      <div className="flex min-h-9 items-center justify-between border-b border-line pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-fg">
          {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? "s" : ""} applied` : "Filters"}
        </span>
        {activeCount > 0 && (
          <button
            onClick={() => {
              router.push("/shop", { scroll: false });
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
              onNavigate?.();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:border-volt hover:text-volt"
          >
            Clear all <Close width={13} height={13} />
          </button>
        )}
      </div>

      <Group title="Size">
        <div className="grid grid-cols-3 gap-2">
          <MiniSelect label="Width" value={current("width")} options={widths} onChange={(v) => setParam("width", v)} />
          <MiniSelect label="Profile" value={current("profile")} options={profiles} onChange={(v) => setParam("profile", v)} />
          <MiniSelect label="Rim" value={current("rim")} options={rims} onChange={(v) => setParam("rim", v)} />
        </div>
      </Group>

      <Group title="Category">
        <ul className="space-y-1">
          <Radio name="type-cat" checked={!current("category") && !current("type")} label="All products" onChange={() => setParams({ type: null, category: null })} />
          <Radio name="type-cat" checked={current("type") === "wheel"} label="Mag Wheels" onChange={() => setParams({ type: "wheel", category: null })} />
          {categories.filter((c) => c.primary && c.slug !== "mag-wheel").map((c) => (
            <Radio
              key={c.slug}
              name="type-cat"
              checked={current("category") === c.slug && current("type") !== "wheel"}
              label={`${c.name} (${c.count})`}
              onChange={() => setParams({ type: null, category: c.slug })}
            />
          ))}
        </ul>
      </Group>

      <Group title="Brand">
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {brands.slice(0, 30).map((b) => (
            <Radio
              key={b.name}
              name="brand"
              checked={current("brand").toLowerCase() === b.name.toLowerCase()}
              label={`${b.name} (${b.count})`}
              onChange={() => setParam("brand", current("brand").toLowerCase() === b.name.toLowerCase() ? null : b.name)}
            />
          ))}
        </div>
      </Group>

      <Group title="Features">
        <CheckRow checked={current("runflat") === "1"} label="Run-flat" onChange={() => setParam("runflat", current("runflat") === "1" ? null : "1")} />
        <CheckRow checked={current("xl") === "1"} label="Extra load (XL)" onChange={() => setParam("xl", current("xl") === "1" ? null : "1")} />
      </Group>

      <Group title="Price">
        <ul className="space-y-1">
          <Radio name="price" checked={!current("min") && !current("max")} label="Any price" onChange={() => setParams({ min: null, max: null })} />
          {([
            ["Under R1 000", "", "1000"],
            ["R1 000 – R2 000", "1000", "2000"],
            ["R2 000 – R3 500", "2000", "3500"],
            ["R3 500 – R6 000", "3500", "6000"],
            ["R6 000+", "6000", ""],
          ] as [string, string, string][]).map(([label, min, max]) => (
            <Radio key={label} name="price" checked={priceActive(min, max)} label={label} onChange={() => setParams({ min: min || null, max: max || null })} />
          ))}
        </ul>
      </Group>

      <Group title="Offers">
        <Radio name="sale" checked={current("onSale") === "1"} label="On sale only" onChange={() => setParam("onSale", current("onSale") === "1" ? null : "1")} />
      </Group>
    </div>
  );
}

function CheckRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 text-left text-sm transition-colors hover:bg-surface"
    >
      <span className={`grid size-4 shrink-0 place-items-center rounded border ${checked ? "border-volt bg-volt" : "border-line-2"}`}>
        {checked && <span className="size-2 rounded-[2px] bg-volt-ink" />}
      </span>
      <span className={checked ? "font-semibold text-fg" : "text-muted"}>{label}</span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line pb-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-fg">{title}</h3>
      {children}
    </div>
  );
}

function MiniSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-line bg-surface-2 px-2 pr-6 text-sm font-semibold text-fg outline-none focus:border-volt"
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" width={13} height={13} />
    </div>
  );
}

function Radio({ checked, label, onChange }: { name?: string; checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 text-left text-sm transition-colors hover:bg-surface"
    >
      <span className={`grid size-4 shrink-0 place-items-center rounded-full border ${checked ? "border-volt bg-volt" : "border-line-2"}`}>
        {checked && <span className="size-1.5 rounded-full bg-volt-ink" />}
      </span>
      <span className={checked ? "font-semibold text-fg" : "text-muted"}>{label}</span>
    </button>
  );
}
