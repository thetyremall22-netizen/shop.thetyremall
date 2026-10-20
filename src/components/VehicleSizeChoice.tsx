"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Close, WhatsApp, Search } from "./icons";
import { parseSize, sizeToShopHref } from "@/lib/tyre-size";
import { WhatsAppGateButton } from "./WhatsAppGate";

// Mirror of the server VehicleRecord (see src/lib/vehicles.ts).
export interface VehicleRecord {
  id: string;
  make: string;
  model: string;
  generation: string | null;
  trim: string | null;
  year: number;
  tyreOptions: string[];
  rimOptions: string[];
  pcd: string | null;
  bore: string | null;
  image: string | null;
  imageLabel: string | null;
  imageYearRange: string | null;
  tyreHrefs: { size: string; href: string; nonStandard: boolean }[];
  rimHrefs: { size: string; href: string }[];
}

const GARAGE_KEY = "ttm-garage-v1";
export interface GarageItem {
  make: string; model: string; year: number; generation: string | null; trim: string | null;
  image: string | null; selectedSize: string | null; tyreOptions: string[]; rimOptions: string[]; pcd: string | null;
}

const prettyPcd = (p: string | null) => (p ? p.replace(/\*/g, "×") : null);

/** The "choose your tyre size" panel. Picking a vehicle never navigates — only
 *  the CTA here does. Shows every tyre option (1–3), rim/PCD, and a multi-size
 *  "show all" option. Used by /vehicle-search and the homepage vehicle box. */
export function VehicleSizeChoice({ record, compact = false }: { record: VehicleRecord; compact?: boolean }) {
  const router = useRouter();
  const { make, model, year, trim, generation, tyreOptions, rimOptions, pcd, image } = record;
  const [size, setSize] = useState(tyreOptions[0] ?? "");
  const [garage, setGarage] = useState<GarageItem[]>([]);

  useEffect(() => { setSize(tyreOptions[0] ?? ""); }, [record.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { const r = localStorage.getItem(GARAGE_KEY); if (r) setGarage(JSON.parse(r)); } catch {} }, []);

  const vehicleLabel = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
  const ctx = { vehicle: vehicleLabel };

  const inGarage = garage.some((g) => g.make === make && g.model === model && g.year === year && g.trim === trim);
  function toggleGarage() {
    let next: GarageItem[];
    if (inGarage) {
      next = garage.filter((g) => !(g.make === make && g.model === model && g.year === year && g.trim === trim));
    } else {
      next = [{ make, model, year, generation, trim, image, selectedSize: size, tyreOptions, rimOptions, pcd }, ...garage].slice(0, 6);
    }
    setGarage(next);
    try { localStorage.setItem(GARAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function search() {
    if (!size) return;
    // persist the chosen size to the garage entry if saved
    router.push(sizeToShopHref(size, { ...ctx }));
  }
  function searchAll() {
    const u = new URLSearchParams({ type: "tyre", sizes: tyreOptions.join("|"), ...ctx });
    router.push(`/shop?${u.toString()}`);
  }

  const caption = (i: number, raw: string) =>
    parseSize(raw).nonStandard ? "Racing/competition size — we'll match this as text"
      : i === 0 ? "Factory fitment · most common" : "Optional / plus size";

  return (
    <div className="card overflow-hidden p-0">
      <div className={`grid gap-5 p-5 ${compact ? "" : "sm:grid-cols-[200px_1fr]"}`}>
        {/* vehicle photo / no-photo */}
        {!compact && (
          <div className="plate grid aspect-[4/3] place-items-center overflow-hidden rounded-xl">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={`${make} ${model}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm text-muted">No photo</span>
            )}
          </div>
        )}

        <div className="min-w-0">
          <h2 className="font-display text-xl text-fg sm:text-2xl">
            Your {year} {make} {model} <span className="text-volt">{trim || "Standard"}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {generation ? `${generation} · ` : ""}{tyreOptions.length > 1 ? `uses these ${tyreOptions.length} sizes` : "uses this size"}
          </p>

          {tyreOptions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-volt/30 bg-volt/5 p-4 text-sm">
              <p className="font-semibold text-fg">We don&apos;t have a listed size for this exact variant yet.</p>
              <WhatsAppGateButton message={`Hi The Tyre Mall! What tyre size fits my ${vehicleLabel}?`} lead={{ source: "whatsapp-chat" }} className="btn mt-3 h-10 border border-[#25D366]/60 bg-[#25D366]/10 px-4 text-sm text-[#25D366] hover:bg-[#25D366]/20">
                <WhatsApp width={16} height={16} /> Ask on WhatsApp
              </WhatsAppGateButton>
            </div>
          ) : (
            <>
              {/* size cards */}
              <div className="mt-4 space-y-2">
                {tyreOptions.map((opt, i) => {
                  const active = size === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSize(opt)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-volt bg-volt/10" : "border-line bg-surface-2 hover:border-line-2"}`}
                    >
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-volt bg-volt" : "border-line-2"}`}>
                        {active && <span className="size-2 rounded-full bg-volt-ink" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg leading-tight text-fg">{opt}</span>
                        <span className="block text-[11px] text-muted">{caption(i, opt)}</span>
                      </span>
                      {i === 0 && <span className="shrink-0 rounded-md bg-volt/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt">Factory</span>}
                    </button>
                  );
                })}
              </div>

              {/* CTAs */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={search} disabled={!size} className="btn btn-volt h-11 flex-1 px-5 text-sm disabled:opacity-50">
                  <Search width={16} height={16} /> Search tyres in {size || "…"}
                </button>
                {tyreOptions.length > 1 && (
                  <button onClick={searchAll} className="btn btn-dark h-11 px-4 text-sm">Show all {tyreOptions.length} sizes</button>
                )}
              </div>
              {tyreOptions.length === 1 && (
                <p className="mt-2 text-xs text-muted">This is the size we&apos;ll search — confirm above.</p>
              )}

              {/* rim / PCD */}
              {rimOptions.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Mag wheels</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {record.rimHrefs.map((r) => (
                      <a key={r.size} href={r.href} className="btn btn-ghost h-9 px-3 text-xs">{r.size}</a>
                    ))}
                    {!pcd && (
                      <span className="rounded-md border border-[#f0b429]/40 bg-[#f0b429]/10 px-2.5 py-1 text-[11px] font-semibold text-[#f0b429]">
                        Fitment to be verified
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Rim: {rimOptions.join(" / ")}{pcd ? ` · PCD ${prettyPcd(pcd)}` : " · bolt pattern to be verified"}
                  </p>
                </div>
              )}

              <button onClick={toggleGarage} className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${inGarage ? "border-volt bg-volt/10 text-volt" : "border-line text-muted hover:text-fg"}`}>
                <Check width={15} height={15} /> {inGarage ? "Saved to My Garage" : "Save to My Garage"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** My Garage grid — saved vehicles with their chosen size. */
export function Garage() {
  const [garage, setGarage] = useState<GarageItem[]>([]);
  useEffect(() => { try { const r = localStorage.getItem(GARAGE_KEY); if (r) setGarage(JSON.parse(r)); } catch {} }, []);
  const save = (g: GarageItem[]) => { setGarage(g); try { localStorage.setItem(GARAGE_KEY, JSON.stringify(g)); } catch {} };
  if (!garage.length) return null;
  return (
    <div>
      <h2 className="font-display text-xl">My Garage</h2>
      <p className="mt-1 text-sm text-muted">Your saved vehicles — jump straight to the right tyres.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {garage.map((g, i) => {
          const size = g.selectedSize || g.tyreOptions[0];
          return (
            <div key={`${g.make}-${g.model}-${g.year}-${i}`} className="card glow-hover flex items-center gap-3 p-3">
              <span className="plate grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg">
                {g.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.image} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base text-fg">{g.make} {g.model}</div>
                <div className="truncate text-xs text-muted">{g.year}{g.trim ? ` · ${g.trim}` : ""}</div>
                <div className="mt-1">
                  {size ? (
                    <a href={sizeToShopHref(size, { vehicle: `${g.year} ${g.make} ${g.model}` })} className="text-xs font-bold text-volt hover:underline">
                      Shop {size} →
                    </a>
                  ) : (
                    <span className="text-xs text-muted">No listed size</span>
                  )}
                </div>
              </div>
              <button onClick={() => save(garage.filter((_, j) => j !== i))} aria-label="Remove" className="shrink-0 text-faint hover:text-sale">
                <Close width={16} height={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
