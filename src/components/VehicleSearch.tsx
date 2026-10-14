"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "./icons";
import { VehicleSizeChoice, Garage, type VehicleRecord } from "./VehicleSizeChoice";

function Sel({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; t: string }[]; placeholder: string; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className="h-12 w-full appearance-none rounded-lg border border-line bg-ink px-3 pr-8 text-sm font-semibold text-fg outline-none focus:border-volt disabled:opacity-50">
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
      </div>
    </label>
  );
}

export function VehicleSearch() {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [records, setRecords] = useState<VehicleRecord[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [recIdx, setRecIdx] = useState("");

  useEffect(() => { fetch("/api/vehicles").then((r) => r.json()).then((d) => setMakes(d.makes || [])).catch(() => {}); }, []);

  useEffect(() => {
    setModel(""); setModels([]); setYears([]); setYear(""); setRecords([]); setRecIdx("");
    if (make) fetch(`/api/vehicles?make=${encodeURIComponent(make)}`).then((r) => r.json()).then((d) => setModels(d.models || [])).catch(() => {});
  }, [make]);

  useEffect(() => {
    setYears([]); setYear(""); setRecords([]); setRecIdx("");
    if (make && model) fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then((r) => r.json()).then((d) => setYears(d.years || [])).catch(() => {});
  }, [make, model]);

  useEffect(() => {
    setRecords([]); setRecIdx("");
    if (make && model && year) fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`).then((r) => r.json()).then((d) => setRecords(d.records || [])).catch(() => {});
  }, [make, model, year]);

  // auto-select when a year has exactly one record
  useEffect(() => { setRecIdx(records.length === 1 ? "0" : ""); }, [records]);

  const record = recIdx === "" ? undefined : records[Number(recIdx)];
  const noData = !!(make && model && year && records.length === 0);
  const availableYears = useMemo(() => years.map((y) => ({ v: String(y), t: String(y) })), [years]);

  return (
    <div className="space-y-6">
      {/* picker */}
      <div className="card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Sel label="Make" value={make} onChange={setMake} placeholder="Select make" options={makes.map((m) => ({ v: m, t: m }))} />
          <Sel label="Model" value={model} onChange={setModel} placeholder={make ? "Select model" : "Pick make first"} disabled={!make} options={models.map((m) => ({ v: m, t: m }))} />
          <Sel label="Year" value={year} onChange={(v) => { setYear(v); setRecIdx(""); }} placeholder={model ? "Select year" : "Pick model first"} disabled={!model} options={availableYears} />
          <Sel
            label="Trim / engine"
            value={recIdx}
            onChange={setRecIdx}
            placeholder={year ? (records.length ? "Select trim" : "—") : "Pick year first"}
            disabled={!year || records.length <= 1}
            options={records.map((r, i) => ({ v: String(i), t: `${r.trim || "Standard"}${r.generation ? ` · ${r.generation}` : ""}` }))}
          />
        </div>
        {records.length > 1 && recIdx === "" && (
          <p className="mt-2 text-xs text-muted">This {year} {make} {model} has {records.length} trims — pick yours to see its exact sizes.</p>
        )}
      </div>

      {/* no exact-year data — show honest empty state + the years that exist */}
      {noData && (
        <div className="card p-5 text-sm">
          <p className="font-semibold text-fg">We don&apos;t have {year} data for the {make} {model}.</p>
          {years.length > 0 && (
            <p className="mt-1 text-muted">Years we do have: {years.slice(0, 16).join(", ")}{years.length > 16 ? "…" : ""}.</p>
          )}
        </div>
      )}

      {/* size choice */}
      {record && <VehicleSizeChoice record={record} />}

      {/* garage */}
      <Garage />
    </div>
  );
}
