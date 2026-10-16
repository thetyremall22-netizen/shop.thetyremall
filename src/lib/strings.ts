import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";

// Editable UI copy. Every key has a default (shipped value); the admin stores
// only overrides, so a missing/blank override always falls back to the default
// — nothing can break by being unset.
export const STRING_DEFAULTS: Record<string, string> = {
  // product card / detail
  "product.per_tyre": "Per tyre",
  "product.set_of_4": "Set of 4",
  "product.view": "View product",
  "product.in_stock": "In stock",
  "product.out_of_stock": "Out of stock",
  "product.on_sale_save": "🔥 On sale — save {pct}%",
  "product.benefit.free_delivery": "Free delivery on 2+ tyres",
  "product.benefit.pay_later": "Pay later 0% interest",
  "product.benefit.road_hazard": "Road hazard optional cover",
  // BNPL
  "bnpl.provider": "HappyPay — no upfront · pay over 2 months",
  // CTAs / sections
  "cta.view_all": "View all",
  "cta.shop_now": "Shop Now",
  "section.fan_favourites.eyebrow": "Flying out the door",
  "section.fan_favourites.heading": "FAN FAVOURITES",
  "section.fresh_mags.eyebrow": "Turn heads on every street",
};

export const STRINGS_TAG = "strings";

const KEY_LABELS: Record<string, string> = {
  "product.per_tyre": "Product card · per-tyre label",
  "product.set_of_4": "Product card · set-of-4 label",
  "product.view": "Product card · view button",
  "product.in_stock": "Stock · in stock",
  "product.out_of_stock": "Stock · out of stock",
  "product.on_sale_save": "Sale line (use {pct} for the percentage)",
  "product.benefit.free_delivery": "Product page · benefit 1",
  "product.benefit.pay_later": "Product page · benefit 2",
  "product.benefit.road_hazard": "Product page · benefit 3",
  "bnpl.provider": "Buy-now-pay-later line",
  "cta.view_all": "“View all” link",
  "cta.shop_now": "Hero · Shop Now button",
  "section.fan_favourites.eyebrow": "Fan Favourites · eyebrow",
  "section.fan_favourites.heading": "Fan Favourites · heading",
  "section.fresh_mags.eyebrow": "Fresh Mags · eyebrow",
};

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS strings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  ensured = true;
}

async function readOverrides(): Promise<Record<string, string>> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT key, value FROM strings");
    const out: Record<string, string> = {};
    for (const row of r.rows as unknown as { key: string; value: string }[]) out[String(row.key)] = String(row.value);
    return out;
  } catch { return {}; }
}

/** Full merged dictionary (defaults + overrides), cached for the storefront. */
export async function getStrings(): Promise<Record<string, string>> {
  "use cache";
  cacheTag(STRINGS_TAG);
  cacheLife("max");
  return { ...STRING_DEFAULTS, ...(await readOverrides()) };
}

/** Interpolate {placeholders}. */
export function fmt(tpl: string, vars: Record<string, string | number> = {}): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// ---- admin ------------------------------------------------------------------
export interface StringRow { key: string; label: string; value: string; isDefault: boolean }
export async function listStrings(): Promise<StringRow[]> {
  const overrides = await readOverrides();
  return Object.keys(STRING_DEFAULTS).sort().map((key) => {
    const has = key in overrides && overrides[key] !== "";
    return { key, label: KEY_LABELS[key] ?? key, value: has ? overrides[key] : STRING_DEFAULTS[key], isDefault: !has };
  });
}

export async function saveString(key: string, value: string): Promise<void> {
  if (!(key in STRING_DEFAULTS)) return;
  await ensureTable();
  // Blank or equal-to-default => clear the override (fall back to default).
  if (value.trim() === "" || value === STRING_DEFAULTS[key]) {
    await libsql.execute({ sql: "DELETE FROM strings WHERE key = ?", args: [key] });
  } else {
    await libsql.execute({ sql: "INSERT INTO strings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [key, value.slice(0, 500)] });
  }
  revalidateTag(STRINGS_TAG, "max");
}
