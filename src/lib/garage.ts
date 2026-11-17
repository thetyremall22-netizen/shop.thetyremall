import "server-only";
import { libsql } from "./db";

// My Garage for signed-in clients: their saved vehicles, stored on the site so
// they follow the client to any device. (Visitors who aren't signed in keep
// their garage in their own browser only.) One row per client; the vehicles
// are a small JSON list (max MAX_VEHICLES).

export const MAX_VEHICLES = 6;

export interface SavedVehicle {
  make: string; model: string; year: number; generation: string | null; trim: string | null;
  image: string | null; selectedSize: string | null; tyreOptions: string[]; rimOptions: string[]; pcd: string | null;
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS customer_garage (
    customer_id INTEGER PRIMARY KEY,
    vehicles TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

const str = (v: unknown, max = 80): string => String(v ?? "").trim().slice(0, max);
const optStr = (v: unknown, max = 80): string | null => (v == null || v === "" ? null : str(v, max) || null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.slice(0, 8).map((x) => str(x, 40)).filter(Boolean) : []);

/** Keep only well-formed vehicles (anything sent from a browser is untrusted). */
export function cleanVehicles(raw: unknown): SavedVehicle[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedVehicle[] = [];
  for (const r of raw.slice(0, MAX_VEHICLES * 2)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const make = str(o.make), model = str(o.model), year = Math.round(Number(o.year));
    if (!make || !model || !(year >= 1900 && year <= 2100)) continue;
    const image = optStr(o.image, 200);
    out.push({
      make, model, year,
      generation: optStr(o.generation), trim: optStr(o.trim),
      // vehicle photos are our own /vehicles/… files only
      image: image && /^\/vehicles\/[a-z0-9-]+\.webp$/.test(image) ? image : null,
      selectedSize: optStr(o.selectedSize, 40),
      tyreOptions: strList(o.tyreOptions), rimOptions: strList(o.rimOptions),
      pcd: optStr(o.pcd, 20),
    });
    if (out.length >= MAX_VEHICLES) break;
  }
  return out;
}

export async function getGarage(customerId: number): Promise<SavedVehicle[]> {
  await ensureTable();
  const r = await libsql.execute({ sql: "SELECT vehicles FROM customer_garage WHERE customer_id = ?", args: [customerId] });
  if (!r.rows[0]) return [];
  try { return cleanVehicles(JSON.parse(String(r.rows[0].vehicles || "[]"))); } catch { return []; }
}

export async function saveGarage(customerId: number, vehicles: SavedVehicle[]): Promise<SavedVehicle[]> {
  await ensureTable();
  const clean = cleanVehicles(vehicles);
  await libsql.execute({
    sql: `INSERT INTO customer_garage (customer_id, vehicles, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(customer_id) DO UPDATE SET vehicles = excluded.vehicles, updated_at = excluded.updated_at`,
    args: [customerId, JSON.stringify(clean), Date.now()],
  });
  return clean;
}
