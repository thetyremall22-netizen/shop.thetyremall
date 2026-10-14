"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "./icons";
import { VehicleSizeChoice, type VehicleRecord } from "./VehicleSizeChoice";

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

/** Self-contained Make→Model→Year→Trim picker that renders the size-choice
 *  panel inline. Nothing navigates until the size-choice CTA is pressed. */
export function VehiclePicker() {
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
  useEffect(() => { setRecIdx(records.length === 1 ? "0" : ""); }, [records]);

  const record = recIdx === "" ? undefined : records[Number(recIdx)];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Sel label="Make" value={make} onChange={setMake} placeholder="Select make" options={makes.map((m) => ({ v: m, t: m }))} />
        <Sel label="Model" value={model} onChange={setModel} placeholder={make ? "Select model" : "Pick make first"} disabled={!make} options={models.map((m) => ({ v: m, t: m }))} />
        <Sel label="Year" value={year} onChange={(v) => { setYear(v); setRecIdx(""); }} placeholder={model ? "Select year" : "Pick model first"} disabled={!model} options={years.map((y) => ({ v: String(y), t: String(y) }))} />
        <Sel label="Trim / engine" value={recIdx} onChange={setRecIdx} placeholder={year ? (records.length ? "Select trim" : "—") : "Pick year first"} disabled={!year || records.length <= 1}
          options={records.map((r, i) => ({ v: String(i), t: `${r.trim || "Standard"}${r.generation ? ` · ${r.generation}` : ""}` }))} />
      </div>

      {records.length > 1 && recIdx === "" && (
        <p className="text-xs text-muted">{records.length} trims for this {year} {make} {model} — pick yours.</p>
      )}
      {make && model && year && records.length === 0 && (
        <p className="text-xs text-muted">No {year} data for the {make} {model}.{years.length ? ` Try: ${years.slice(0, 10).join(", ")}.` : ""}</p>
      )}

      {record && <VehicleSizeChoice record={record} compact />}
    </div>
  );
}
