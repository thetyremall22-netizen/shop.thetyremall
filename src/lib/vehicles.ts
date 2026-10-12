import "server-only";
import vehiclesData from "@/data/vehicles.json";

export interface Vehicle {
  make: string;
  model: string;
  gen: string;
  trim: string;
  yearFrom: number | null;
  yearTo: number | null;
  tyres: string[];
  rims: string[];
  pcd: string;
  bore: string;
  image: string;
  label: string;
}

export const vehicles = vehiclesData as unknown as Vehicle[];

export function getMakes(): string[] {
  return [...new Set(vehicles.map((v) => v.make))].sort();
}

export function getModels(make: string): string[] {
  const m = make.toLowerCase();
  return [...new Set(vehicles.filter((v) => v.make.toLowerCase() === m).map((v) => v.model))].sort();
}

export interface VehicleFit { make: string; model: string; years: string }

/** Vehicles whose factory tyre size matches `size` (e.g. "205/55R16"). */
export function vehiclesForSize(size: string, limit = 12): VehicleFit[] {
  const key = (size || "").replace(/\s+/g, "").toUpperCase();
  if (!/^\d{2,3}\/\d{2}R\d{2}$/.test(key)) return [];
  const seen = new Set<string>();
  const out: VehicleFit[] = [];
  for (const v of vehicles) {
    if (!v.tyres?.some((t) => t.replace(/\s+/g, "").toUpperCase() === key)) continue;
    const id = `${v.make}|${v.model}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ make: v.make, model: v.model, years: v.label });
    if (out.length >= limit) break;
  }
  return out;
}

export function getVariants(make: string, model: string): Vehicle[] {
  const mk = make.toLowerCase(), md = model.toLowerCase();
  return vehicles
    .filter((v) => v.make.toLowerCase() === mk && v.model.toLowerCase() === md)
    .sort((a, b) => (b.yearFrom ?? 0) - (a.yearFrom ?? 0));
}

const MAKE_ALIASES: Record<string, string> = {
  vw: "volkswagen", merc: "mercedes", benz: "mercedes", "mercedes-benz": "mercedes",
  chevy: "chevrolet", beemer: "bmw", bimmer: "bmw", landrover: "land rover",
  "range rover": "land rover", mahindra: "mahindra", bakkie: "", toyota: "toyota",
};

/** Find the best vehicle for a free-text query (for Tyrone). */
export function findVehicle(text: string): Vehicle | null {
  let q = text.toLowerCase();
  for (const [alias, real] of Object.entries(MAKE_ALIASES)) {
    if (real && q.includes(alias)) q += " " + real;
  }
  const yearMatch = q.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;
  let best: Vehicle | null = null;
  let bestScore = 0;
  for (const v of vehicles) {
    const mk = v.make.toLowerCase();
    const md = v.model.toLowerCase();
    if (!q.includes(mk)) continue;
    let score = 1;
    if (md && q.includes(md)) score += 2;
    if (year && v.yearFrom && v.yearTo && year >= v.yearFrom && year <= v.yearTo) score += 2;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return bestScore >= 3 ? best : null; // need make + (model or matching year)
}

// ---- size parsing → shop search params --------------------------------------
export function parseTyre(size: string): { width?: string; profile?: string; rim?: string } {
  const m = size.match(/(\d{3})\s*\/\s*(\d{2})\s*r?\s*(\d{2})/i);
  return m ? { width: m[1], profile: m[2], rim: m[3] } : {};
}

export function rimDiameter(rimSize: string): string | null {
  const m = rimSize.match(/x\s*(\d{2})(?:\.\d)?/i) || rimSize.match(/r?\s*(\d{2})\b/i);
  return m ? m[1] : null;
}

export function normPcd(pcd: string): string {
  return pcd.replace(/\s/g, "").replace(/\*/g, "X").toUpperCase();
}

export function tyreSearchHref(size: string): string {
  const t = parseTyre(size);
  const u = new URLSearchParams();
  if (t.width) u.set("width", t.width);
  if (t.profile) u.set("profile", t.profile);
  if (t.rim) u.set("rim", t.rim);
  return `/shop?${u.toString()}`;
}

export function wheelSearchHref(rimSize: string, pcd: string): string {
  const d = rimDiameter(rimSize);
  const u = new URLSearchParams({ type: "wheel" });
  if (d) u.set("rim", d);
  const p = normPcd(pcd);
  if (p) u.set("pcd", p);
  return `/shop?${u.toString()}`;
}
