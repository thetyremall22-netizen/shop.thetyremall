"use client";

import { useEffect, useState } from "react";
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
  const [vi, setVi] = useState("");

  useEffect(() => { fetch("/api/vehicles").then((r) => r.json()).then((d) => setMakes(d.makes || [])).catch(() => {}); }, []);
  useEffect(() => {
    onSelect(null); setModel(""); setModels([]); setVariants([]); setVi("");
    if (make) fetch(`/api/vehicles?make=${encodeURIComponent(make)}`).then((r) => r.json()).then((d) => setModels(d.models || [])).catch(() => {});
  }, [make]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onSelect(null); setVariants([]); setVi("");
    if (make && model) fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then((r) => r.json()).then((d) => setVariants(d.variants || [])).catch(() => {});
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(idx: string) {
    setVi(idx);
    onSelect(idx === "" ? null : variants[Number(idx)] ?? null);
  }

  const sel = vi === "" ? null : variants[Number(vi)];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Sel label="Make" value={make} onChange={setMake} placeholder="Select make" options={makes.map((m) => ({ v: m, t: m }))} />
        <Sel label="Model" value={model} onChange={setModel} placeholder={make ? "Select model" : "Pick make first"} disabled={!make} options={models.map((m) => ({ v: m, t: m }))} />
        <Sel label="Year" value={vi} onChange={pick} placeholder={model ? "Select year" : "Pick model first"} disabled={!model}
          options={variants.map((v, i) => ({ v: String(i), t: `${v.yearFrom ?? ""}${v.yearTo && v.yearTo !== v.yearFrom ? `–${v.yearTo}` : ""}${v.trim ? ` · ${v.trim}` : ""}` }))} />
      </div>

      {sel && (
        <div className="flex items-center gap-3 rounded-xl border border-volt/30 bg-volt/5 p-3">
          {sel.image && <img src={sel.image} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0 text-xs">
            <div className="font-bold text-fg">{make} {model} <span className="text-muted">{sel.label}</span></div>
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
