"use client";

import { useRouter } from "next/navigation";
import { shopHref } from "@/lib/shop-url";
import { useState } from "react";
import { ChevronDown } from "./icons";

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <label className="flex-1">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full appearance-none rounded-lg border border-line bg-surface-2 px-3 pr-9 text-sm font-semibold text-fg outline-none focus:border-volt"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={16} height={16} />
      </div>
    </label>
  );
}

export function TyreFinder({
  widths,
  profiles,
  rims,
}: {
  widths: string[];
  profiles: string[];
  rims: string[];
}) {
  const router = useRouter();
  const [width, setWidth] = useState("");
  const [profile, setProfile] = useState("");
  const [rim, setRim] = useState("");

  function find() {
    const params = new URLSearchParams();
    if (width) params.set("width", width);
    if (profile) params.set("profile", profile);
    if (rim) params.set("rim", rim);
    router.push(shopHref(params));
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Tyre Finder</span>
        <span className="text-xs text-muted">— match your exact size</span>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select label="Width" value={width} onChange={setWidth} options={widths} placeholder="e.g. 265" />
        <Select label="Profile" value={profile} onChange={setProfile} options={profiles} placeholder="e.g. 60" />
        <Select label="Rim" value={rim} onChange={setRim} options={rims} placeholder="e.g. 18" />
        <button onClick={find} className="btn btn-volt h-12 px-8 sm:w-auto">
          Find Tyres
        </button>
      </div>
    </div>
  );
}
