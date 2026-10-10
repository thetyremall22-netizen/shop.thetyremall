"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, ChevronDown } from "./icons";

type Mode = "size" | "vehicle" | "brand";

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
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-line bg-ink px-3 pr-8 text-sm font-semibold text-fg outline-none focus:border-volt"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" width={14} height={14} />
      </div>
    </label>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  cta,
  brands,
  bigField,
  threeFields,
  onSearch,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  cta: string;
  brands: string[];
  bigField: React.ReactNode;
  threeFields: (brandField: React.ReactNode) => React.ReactNode;
  onSearch: (mode: Mode, brand: string, vehicle: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("size");
  const [brand, setBrand] = useState("");
  const [vehicle, setVehicle] = useState("");

  const brandField = (
    <Select label="Brand" value={brand} onChange={setBrand} options={brands} placeholder="All brands" />
  );

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-volt ring-1 ring-line">{icon}</span>
          <div>
            <h3 className="font-display text-xl leading-none">
              SEARCH FOR <span className="text-volt">{title}</span>
            </h3>
            <p className="mt-1 text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="mb-1 block text-[10px] text-muted">Search by:</span>
          <div className="flex items-center gap-1">
            {(["size", "vehicle", "brand"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                  mode === m ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {mode === "vehicle" ? (
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted">Your vehicle</span>
            <input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="e.g. VW Polo, Ford Ranger, Toyota Corolla…"
              className="h-11 w-full rounded-lg border border-line bg-ink px-3 text-sm font-semibold text-fg outline-none focus:border-volt"
            />
          </label>
        ) : mode === "brand" ? (
          <div className="max-w-xs">{brandField}</div>
        ) : (
          <>
            {bigField}
            <div className="grid grid-cols-3 gap-2.5">{threeFields(brandField)}</div>
          </>
        )}
      </div>

      <button onClick={() => onSearch(mode, brand, vehicle)} className="btn btn-volt mt-4 w-full py-3.5 text-base">
        <Search width={18} height={18} /> {cta}
      </button>
    </div>
  );
}

export function TyreWheelSearch({
  widths,
  profiles,
  rims,
  wheelRims,
  wheelWidths,
  pcds,
  tyreBrands,
  wheelBrands,
}: {
  widths: string[];
  profiles: string[];
  rims: string[];
  wheelRims: string[];
  wheelWidths: string[];
  pcds: string[];
  tyreBrands: string[];
  wheelBrands: string[];
}) {
  const router = useRouter();
  const [tw, setTw] = useState("");
  const [tp, setTp] = useState("");
  const [tr, setTr] = useState("");
  const [wr, setWr] = useState("");
  const [wpcd, setWpcd] = useState("");
  const [ww, setWw] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="TYRES"
        subtitle="Find the right tyres for your vehicle"
        cta="Search Tyres"
        brands={tyreBrands}
        icon={<TyreIcon />}
        bigField={<Select label="Tyre Size" value={tw} onChange={setTw} options={widths} placeholder="Select width" />}
        threeFields={(brandField) => (
          <>
            <Select label="Profile" value={tp} onChange={setTp} options={profiles} placeholder="Profile" />
            <Select label="Rim Size" value={tr} onChange={setTr} options={rims} placeholder="Rim" />
            {brandField}
          </>
        )}
        onSearch={(mode, brand, vehicle) => {
          const p = new URLSearchParams({ type: "tyre" });
          if (mode === "vehicle" && vehicle) p.set("q", vehicle);
          else if (mode === "brand" && brand) p.set("brand", brand);
          else {
            if (tw) p.set("width", tw);
            if (tp) p.set("profile", tp);
            if (tr) p.set("rim", tr);
            if (brand) p.set("brand", brand);
          }
          router.push(`/shop?${p.toString()}`);
        }}
      />

      <Panel
        title="WHEELS"
        subtitle="Find the perfect mag wheels for your ride"
        cta="Search Wheels"
        brands={wheelBrands}
        icon={<WheelIcon />}
        bigField={<Select label="Rim Size" value={wr} onChange={setWr} options={wheelRims} placeholder="Select rim size" />}
        threeFields={(brandField) => (
          <>
            <Select label="PCD" value={wpcd} onChange={setWpcd} options={pcds} placeholder="Select PCD" />
            <Select label="Width" value={ww} onChange={setWw} options={wheelWidths} placeholder="Select width" />
            {brandField}
          </>
        )}
        onSearch={(mode, brand, vehicle) => {
          const p = new URLSearchParams({ type: "wheel" });
          if (mode === "vehicle" && vehicle) p.set("q", vehicle);
          else if (mode === "brand" && brand) p.set("brand", brand);
          else {
            if (wr) p.set("rim", wr);
            if (wpcd) p.set("pcd", wpcd);
            if (ww) p.set("width", ww);
            if (brand) p.set("brand", brand);
          }
          router.push(`/shop?${p.toString()}`);
        }}
      />
    </div>
  );
}

function TyreIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
    </svg>
  );
}
function WheelIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" />
      <path d="M12 4 10.5 10M20 12 14 11M14 18l-1-6M4 12l6-1M14 6l-1.5 5" strokeLinecap="round" />
    </svg>
  );
}
