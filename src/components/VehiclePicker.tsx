"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "./icons";

export interface Variant {
  gen: string;
  trim: string;
  yearFrom: number | null;
  yearTo: number | null;
  label: string;
  tyres: string[];
  rims: string[];
  pcd: string;
  bore: string;
  image: string | null;
  tyreHref: string;
  wheelHref: string;
}

function Sel({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; t: string }[]; placeholder: string; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="h-11 w-full appearance-none rounded-lg border border-line bg-ink px-3 pr-8 text-sm font-semibold text-fg outline-none focus:border-volt disabled:opacity-50">
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
      </div>
    </label>
  );
}

export function VehiclePicker({ onSelect }: { onSelect: (v: Variant | null) => void }) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [ti, setTi] = useState("0");

  useEffect(() => { fetch("/api/vehicles").then((r) => r.json()).then((d) => setMakes(d.makes || [])).catch(() => {}); }, []);
  useEffect(() => {
    setModel(""); setModels([]); setVariants([]); setYear(""); setTi("0");
    if (make) fetch(`/api/vehicles?make=${encodeURIComponent(make)}`).then((r) => r.json()).then((d) => setModels(d.models || [])).catch(() => {});
  }, [make]);
  useEffect(() => {
    setVariants([]); setYear(""); setTi("0");
    if (make && model) fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then((r) => r.json()).then((d) => setVariants(d.variants || [])).catch(() => {});
  }, [make, model]);

  // Single years (newest first), expanded from each generation's year range.
  const years = useMemo(() => {
    const s = new Set<number>();
    for (const v of variants) {
      const a = v.yearFrom, b = v.yearTo ?? v.yearFrom;
      if (a != null && b != null) for (let y = b; y >= a; y--) s.add(y);
    }
    return [...s].sort((x, z) => z - x).map(String);
  }, [variants]);
  const yearVariants = useMemo(() => {
    if (!year) return [];
    const y = Number(year);
    return variants.filter((v) => (v.yearFrom ?? -1) <= y && (v.yearTo ?? 9999) >= y);
  }, [variants, year]);
  const sel = yearVariants.length ? (yearVariants[Number(ti)] ?? yearVariants[0]) : null;

  useEffect(() => { onSelect(sel); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Sel label="Make" value={make} onChange={setMake} placeholder="Select make" options={makes.map((m) => ({ v: m, t: m }))} />
        <Sel label="Model" value={model} onChange={setModel} placeholder={make ? "Select model" : "Pick make first"} disabled={!make} options={models.map((m) => ({ v: m, t: m }))} />
        <Sel label="Year" value={year} onChange={(v) => { setYear(v); setTi("0"); }} placeholder={model ? "Select year" : "Pick model first"} disabled={!model}
          options={years.map((y) => ({ v: y, t: y }))} />
      </div>

      {yearVariants.length > 1 && (
        <Sel label="Trim / engine" value={ti} onChange={setTi} placeholder="Select trim"
          options={yearVariants.map((v, i) => ({ v: String(i), t: `${v.trim || "Standard"}${v.gen ? ` · ${v.gen}` : ""}` }))} />
      )}

      {sel && (
        <div className="flex items-center gap-3 rounded-xl border border-volt/30 bg-volt/5 p-3">
          {sel.image && <img src={sel.image} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0 text-xs">
            <div className="font-bold text-fg">{make} {model} <span className="text-volt">{year}</span></div>
            <div className="mt-0.5 text-muted">
              <span className="text-volt">Tyre:</span> {sel.tyres.join(" / ") || "—"}
            </div>
            <div className="text-muted"><span className="text-volt">Rim:</span> {sel.rims.join(" / ") || "—"}{sel.pcd ? ` · PCD ${sel.pcd.replace(/\*/g, "×")}` : ""}</div>
          </div>
        </div>
      )}
    </div>
  );
}
