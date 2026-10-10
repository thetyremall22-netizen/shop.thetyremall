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
      <button
        onClick={() => setMobileOpen(true)}
        className="btn btn-dark w-full lg:hidden"
      >
        <Filter width={16} height={16} /> Filters
      </button>

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

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(search);
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
      next.delete("page");
      router.push(`/shop?${next.toString()}`);
      onNavigate?.();
    },
    [search, router, onNavigate]
  );

  const current = (k: string) => params.get(k) ?? "";
  const activeCount = ["category", "brand", "width", "profile", "rim", "type", "onSale", "q"].filter((k) => params.get(k)).length;

  return (
    <div className="space-y-5">
      {activeCount > 0 && (
        <button
          onClick={() => {
            router.push("/shop");
            onNavigate?.();
          }}
          className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted hover:text-volt"
        >
          Clear all filters <Close width={14} height={14} />
        </button>
      )}

      <Group title="Size">
        <div className="grid grid-cols-3 gap-2">
          <MiniSelect label="Width" value={current("width")} options={widths} onChange={(v) => setParam("width", v)} />
          <MiniSelect label="Profile" value={current("profile")} options={profiles} onChange={(v) => setParam("profile", v)} />
          <MiniSelect label="Rim" value={current("rim")} options={rims} onChange={(v) => setParam("rim", v)} />
        </div>
      </Group>

      <Group title="Category">
        <ul className="space-y-1">
          <Radio name="type-cat" checked={!current("category") && !current("type")} label="All products" onChange={() => { setParam("type", null); setParam("category", null); }} />
          <Radio name="type-cat" checked={current("type") === "wheel"} label="Mag Wheels" onChange={() => setParam("type", "wheel")} />
          {categories.filter((c) => c.primary).map((c) => (
            <Radio
              key={c.slug}
              name="type-cat"
              checked={current("category") === c.slug}
              label={`${c.name} (${c.count})`}
              onChange={() => { setParam("type", null); setParam("category", c.slug); }}
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

      <Group title="Offers">
        <Radio name="sale" checked={current("onSale") === "1"} label="On sale only" onChange={() => setParam("onSale", current("onSale") === "1" ? null : "1")} />
      </Group>
    </div>
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

function Radio({ name, checked, label, onChange }: { name: string; checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
      <span
        onClick={onChange}
        className={`grid size-4 shrink-0 place-items-center rounded-full border ${checked ? "border-volt bg-volt" : "border-line-2"}`}
      >
        {checked && <span className="size-1.5 rounded-full bg-volt-ink" />}
      </span>
      <span onClick={onChange} className={checked ? "font-semibold text-fg" : "text-muted hover:text-fg"}>{label}</span>
    </label>
  );
}
