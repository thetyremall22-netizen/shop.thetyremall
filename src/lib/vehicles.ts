import "server-only";
import vehiclesData from "@/data/vehicles.json";
import { parseSize, canonicalSize, sizeToShopHref } from "./tyre-size";

// One entry per (make, model, generation, trim, fitment) group. `years` is the
// list of DISCRETE years that group actually has data for (gaps preserved).
export interface VehicleGroup {
  make: string;
  model: string;
  generation: string | null;
  trim: string | null;
  years: number[];
  tyreOptions: string[];
  rimOptions: string[];
  pcd: string | null;
  bore: string | null;
  nutThread: string | null;
  boltThread: string | null;
  image: string | null; // local slug under /public/vehicles, or null
  imageLabel: string | null;
  imageYearRange: string | null;
}

export const vehicles = vehiclesData as unknown as VehicleGroup[];

const imgPath = (slug: string | null) => (slug ? `/vehicles/${slug}.webp` : null);

export function getMakes(): string[] {
  return [...new Set(vehicles.map((v) => v.make))].sort();
}

export function getModels(make: string): string[] {
  const m = make.toLowerCase();
  return [...new Set(vehicles.filter((v) => v.make.toLowerCase() === m).map((v) => v.model))].sort();
}

/** make -> sorted models, for the chat's free-text parsing + model buttons. */
export function getMakeModelIndex(): Record<string, string[]> {
  const idx: Record<string, Set<string>> = {};
  for (const v of vehicles) (idx[v.make] ??= new Set()).add(v.model);
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(idx).sort()) out[k] = [...idx[k]].sort();
  return out;
}

/** Distinct years that exist for a make+model, newest first (never a range). */
export function getYears(make: string, model: string): number[] {
  const mk = make.toLowerCase(), md = model.toLowerCase();
  const s = new Set<number>();
  for (const v of vehicles) {
    if (v.make.toLowerCase() === mk && v.model.toLowerCase() === md) v.years.forEach((y) => s.add(y));
  }
  return [...s].sort((a, b) => b - a);
}

export type VehicleRecord = {
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
  nutThread: string | null;
  boltThread: string | null;
  image: string | null;
  imageLabel: string | null;
  imageYearRange: string | null;
  tyreHrefs: { size: string; href: string; nonStandard: boolean }[];
  rimHrefs: { size: string; href: string }[];
  tyreHref: string; // legacy = tyreHrefs[0]?.href
};

function toRecord(v: VehicleGroup, year: number): VehicleRecord {
  const tyreHrefs = v.tyreOptions.map((size) => ({
    size,
    href: sizeToShopHref(size, { type: "tyre" }),
    nonStandard: !!parseSize(size).nonStandard,
  }));
  const rimHrefs = v.rimOptions.map((size) => ({ size, href: wheelSearchHref(size, v.pcd ?? "") }));
  return {
    id: `${v.make}|${v.model}|${v.generation ?? ""}|${v.trim ?? ""}|${year}`,
    make: v.make, model: v.model, generation: v.generation, trim: v.trim, year,
    tyreOptions: v.tyreOptions, rimOptions: v.rimOptions, pcd: v.pcd, bore: v.bore,
    nutThread: v.nutThread, boltThread: v.boltThread,
    image: imgPath(v.image), imageLabel: v.imageLabel, imageYearRange: v.imageYearRange,
    tyreHrefs, rimHrefs, tyreHref: tyreHrefs[0]?.href ?? "/shop?type=tyre",
  };
}

/** Every record (across trims/generations) for an exact make+model+year. */
export function getRecords(make: string, model: string, year: number): VehicleRecord[] {
  const mk = make.toLowerCase(), md = model.toLowerCase();
  return vehicles
    .filter((v) => v.make.toLowerCase() === mk && v.model.toLowerCase() === md && v.years.includes(year))
    .map((v) => toRecord(v, year));
}

export interface VehicleFit { make: string; model: string; years: string }

const yearSpan = (ys: number[]) => (ys.length > 1 ? `${Math.min(...ys)}-${Math.max(...ys)}` : String(ys[0] ?? ""));

/** Vehicles whose factory tyre size matches `size` (e.g. "205/55R16"). */
export function vehiclesForSize(size: string, limit = 12): VehicleFit[] {
  const key = canonicalSize(size) ?? (size || "").replace(/\s+/g, "").toUpperCase();
  const seen = new Set<string>();
  const out: VehicleFit[] = [];
  for (const v of vehicles) {
    if (!v.tyreOptions.some((t) => canonicalSize(t) === key)) continue;
    const id = `${v.make}|${v.model}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ make: v.make, model: v.model, years: yearSpan(v.years) });
    if (out.length >= limit) break;
  }
  return out;
}

const MAKE_ALIASES: Record<string, string> = {
  vw: "volkswagen", vdub: "volkswagen", merc: "mercedes", benz: "mercedes", "mercedes-benz": "mercedes",
  chevy: "chevrolet", beemer: "bmw", bimmer: "bmw", landrover: "land rover",
  "range rover": "land rover",
};

const wordIn = (hay: string, needle: string) =>
  new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);

export interface VehicleMatch {
  make: string;
  model: string;
  tyres: string[];
  rims: string[];
  pcd: string | null;
  label: string;
}

/** Best vehicle for a free-text query. Matches on make+model, make+year, or a
 *  distinctive model on its own (e.g. "hilux"). Year, when present, narrows to
 *  the groups that actually have that year. */
export function findVehicle(text: string): VehicleMatch | null {
  let q = text.toLowerCase();
  for (const [alias, real] of Object.entries(MAKE_ALIASES)) {
    if (q.includes(alias)) q += " " + real;
  }
  const yearMatch = q.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  let best: VehicleGroup | null = null;
  let bestScore = 0;
  for (const v of vehicles) {
    const mk = v.make.toLowerCase();
    const md = v.model.toLowerCase();
    const makeHit = q.includes(mk);
    const modelHit = md.length >= 3 && wordIn(q, md);
    if (!makeHit && !(modelHit && md.length >= 4)) continue;
    let score = 0;
    if (makeHit) score += 2;
    if (modelHit) score += 2;
    if (year && v.years.includes(year)) score += 3;
    // prefer stronger matches, then the newer group on ties
    const newer = Math.max(...v.years);
    const bestNewer = best ? Math.max(...best.years) : -1;
    if (score > bestScore || (score === bestScore && newer > bestNewer)) {
      bestScore = score; best = v;
    }
  }
  if (!best || bestScore < 2) return null;

  // If a year was asked and matched, union the sizes of all groups for that
  // exact make+model+year so alternates aren't lost.
  if (year && best.years.includes(year)) {
    const recs = getRecords(best.make, best.model, year);
    const tyres = [...new Set(recs.flatMap((r) => r.tyreOptions))];
    const rims = [...new Set(recs.flatMap((r) => r.rimOptions))];
    const pcd = recs.find((r) => r.pcd)?.pcd ?? null;
    return { make: best.make, model: best.model, tyres, rims, pcd, label: String(year) };
  }
  return {
    make: best.make, model: best.model,
    tyres: best.tyreOptions, rims: best.rimOptions, pcd: best.pcd, label: yearSpan(best.years),
  };
}

/** All factory tyre sizes (canonical) across a make+model. */
export function factorySizes(make: string, model: string): string[] {
  const mk = make.toLowerCase(), md = model.toLowerCase();
  const out = new Set<string>();
  for (const v of vehicles) {
    if (v.make.toLowerCase() !== mk || v.model.toLowerCase() !== md) continue;
    for (const t of v.tyreOptions) {
      const c = canonicalSize(t);
      if (c) out.add(c);
    }
  }
  return [...out];
}

// ---- size parsing → shop search params (delegates to the shared parser) ------
export function parseTyre(size: string): { width?: string; profile?: string; rim?: string } {
  const p = parseSize(size);
  return p.nonStandard ? {} : { width: p.width, profile: p.profile, rim: p.rim };
}

export function rimDiameter(rimSize: string): string | null {
  const m = rimSize.match(/x\s*(\d{2})(?:\.\d)?/i) || rimSize.match(/r?\s*(\d{2})\b/i);
  return m ? m[1] : null;
}

export function normPcd(pcd: string): string {
  return pcd.replace(/\s/g, "").replace(/\*/g, "X").toUpperCase();
}

export function tyreSearchHref(size: string): string {
  return sizeToShopHref(size, { type: "tyre" });
}

export function wheelSearchHref(rimSize: string, pcd: string): string {
  const d = rimDiameter(rimSize);
  const u = new URLSearchParams({ type: "wheel" });
  if (d) u.set("rim", d);
  const p = normPcd(pcd);
  if (p) u.set("pcd", p);
  return `/shop?${u.toString()}`;
}
