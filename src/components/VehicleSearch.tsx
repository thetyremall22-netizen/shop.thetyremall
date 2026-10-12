"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Truck, Check, Close, WhatsApp } from "./icons";
import { whatsappHref } from "@/lib/shop-config";

interface Variant {
  gen: string; trim: string; yearFrom: number | null; yearTo: number | null;
  label: string; tyres: string[]; rims: string[]; pcd: string; bore: string;
  image: string | null; tyreHref: string; wheelHref: string;
}
interface GarageItem {
  make: string; model: string; label: string; trim: string;
  image: string | null; tyres: string[]; rims: string[]; pcd: string;
}

const GARAGE_KEY = "ttm-garage-v1";
const shopHref = (size: string) => `/shop?q=${encodeURIComponent(size)}`;

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
  const [variants, setVariants] = useState<Variant[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");   // label (year range)
  const [trimIdx, setTrimIdx] = useState(""); // index into trims-for-year
  const [garage, setGarage] = useState<GarageItem[]>([]);

  useEffect(() => { fetch("/api/vehicles").then((r) => r.json()).then((d) => setMakes(d.makes || [])).catch(() => {}); }, []);
  useEffect(() => { try { const r = localStorage.getItem(GARAGE_KEY); if (r) setGarage(JSON.parse(r)); } catch {} }, []);
  const saveGarage = (g: GarageItem[]) => { setGarage(g); try { localStorage.setItem(GARAGE_KEY, JSON.stringify(g)); } catch {} };

  useEffect(() => {
    setModel(""); setModels([]); setVariants([]); setYear(""); setTrimIdx("");
    if (make) fetch(`/api/vehicles?make=${encodeURIComponent(make)}`).then((r) => r.json()).then((d) => setModels(d.models || [])).catch(() => {});
  }, [make]);
  useEffect(() => {
    setVariants([]); setYear(""); setTrimIdx("");
    if (make && model) fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then((r) => r.json()).then((d) => setVariants(d.variants || [])).catch(() => {});
  }, [make, model]);

  // group variants into year-ranges (labels), then trims within the chosen year
  const years = useMemo(() => [...new Set(variants.map((v) => v.label))], [variants]);
  const trims = useMemo(() => variants.filter((v) => v.label === year), [variants, year]);
  const sel: Variant | undefined = trimIdx === "" ? undefined : trims[Number(trimIdx)];

  // auto-select the trim when a year has exactly one
  useEffect(() => { setTrimIdx(trims.length === 1 ? "0" : ""); }, [year, trims.length]);

  const inGarage = sel && garage.some((g) => g.make === make && g.model === model && g.label === sel.label && g.trim === sel.trim);
  function toggleGarage() {
    if (!sel) return;
    if (inGarage) {
      saveGarage(garage.filter((g) => !(g.make === make && g.model === model && g.label === sel.label && g.trim === sel.trim)));
    } else {
      saveGarage([{ make, model, label: sel.label, trim: sel.trim, image: sel.image, tyres: sel.tyres, rims: sel.rims, pcd: sel.pcd }, ...garage].slice(0, 6));
    }
  }

  const [factory, ...optional] = sel?.tyres ?? [];

  return (
    <div className="space-y-6">
      {/* picker */}
      <div className="card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Sel label="Make" value={make} onChange={setMake} placeholder="Select make" options={makes.map((m) => ({ v: m, t: m }))} />
          <Sel label="Model" value={model} onChange={setModel} placeholder={make ? "Select model" : "Pick make first"} disabled={!make} options={models.map((m) => ({ v: m, t: m }))} />
          <Sel label="Year" value={year} onChange={(v) => { setYear(v); setTrimIdx(""); }} placeholder={model ? "Select year" : "Pick model first"} disabled={!model} options={years.map((y) => ({ v: y, t: y }))} />
          <Sel label="Trim / engine" value={trimIdx} onChange={setTrimIdx} placeholder={year ? "Select trim" : "Pick year first"} disabled={!year} options={trims.map((v, i) => ({ v: String(i), t: v.trim || "Standard" }))} />
        </div>
      </div>

      {/* result */}
      {sel && (
        <div className="card overflow-hidden p-0">
          <div className="grid gap-5 p-5 sm:grid-cols-[200px_1fr]">
            <div className="plate grid aspect-[4/3] place-items-center overflow-hidden rounded-xl">
              {sel.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sel.image} alt={`${make} ${model}`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-neutral-400">No photo</span>
              )}
            </div>
            <div>
              <h2 className="font-display text-2xl text-fg">{make} {model}</h2>
              <p className="text-sm text-muted">{sel.label}{sel.trim ? ` · ${sel.trim}` : ""}</p>

              {factory ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-volt">Factory size</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Link href={shopHref(factory)} className="btn btn-volt h-10 px-4 text-sm">
                        {factory.replace(/\s+/g, " ")} — shop tyres
                      </Link>
                    </div>
                  </div>
                  {optional.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Optional / plus sizes</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {optional.map((s) => (
                          <Link key={s} href={shopHref(s)} className="btn btn-ghost h-10 px-4 text-sm">{s.replace(/\s+/g, " ")}</Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {(sel.rims.length > 0 || sel.pcd) && (
                    <p className="text-xs text-muted">
                      {sel.rims.length > 0 && <>Rim: {sel.rims.join(" / ")} </>}
                      {sel.pcd && <>· PCD {sel.pcd.replace(/\*/g, "×")}</>}
                      {sel.rims[0] && <> · <Link href={sel.wheelHref} className="font-semibold text-volt hover:underline">matching mag wheels →</Link></>}
                    </p>
                  )}
                  <button onClick={toggleGarage} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${inGarage ? "border-volt bg-volt/10 text-volt" : "border-line text-muted hover:text-fg"}`}>
                    <Check width={15} height={15} /> {inGarage ? "Saved to My Garage" : "Save to My Garage"}
                  </button>
                </div>
              ) : (
                // Item 25 — no listed factory size
                <div className="mt-4 rounded-xl border border-volt/30 bg-volt/5 p-4 text-sm">
                  <p className="font-semibold text-fg">We don&apos;t have a listed factory size for this exact variant yet.</p>
                  <p className="mt-1 text-muted">Send us your vehicle details and we&apos;ll confirm the right fitment.</p>
                  <a href={whatsappHref(`Hi The Tyre Mall! What tyre size fits my ${make} ${model} ${sel.label}${sel.trim ? ` ${sel.trim}` : ""}?`)} target="_blank" rel="noopener noreferrer" className="btn mt-3 h-10 border border-[#25D366]/60 bg-[#25D366]/10 px-4 text-sm text-[#25D366] hover:bg-[#25D366]/20">
                    <WhatsApp width={16} height={16} /> Ask on WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My Garage */}
      {garage.length > 0 && (
        <div>
          <h2 className="font-display text-xl">My Garage</h2>
          <p className="mt-1 text-sm text-muted">Your saved vehicles — jump straight to the right tyres.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {garage.map((g, i) => (
              <div key={`${g.make}-${g.model}-${g.label}-${i}`} className="card glow-hover flex items-center gap-3 p-3">
                <span className="plate grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg">
                  {g.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base text-fg">{g.make} {g.model}</div>
                  <div className="truncate text-xs text-muted">{g.label}{g.trim ? ` · ${g.trim}` : ""}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {g.tyres[0] ? (
                      <Link href={shopHref(g.tyres[0])} className="text-xs font-bold text-volt hover:underline">Shop {g.tyres[0].replace(/\s+/g, " ")} →</Link>
                    ) : (
                      <span className="text-xs text-muted">No listed size</span>
                    )}
                  </div>
                </div>
                <button onClick={() => saveGarage(garage.filter((_, j) => j !== i))} aria-label="Remove" className="shrink-0 text-faint hover:text-sale">
                  <Close width={16} height={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
