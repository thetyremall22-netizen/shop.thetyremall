import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { db, schema, libsql } from "./db";
import * as sc from "./shop-config";

// The "coming soon" gate is enforced by the proxy (Node runtime), which reads a
// plain flag file off disk rather than self-fetching /api/maintenance (that
// round-trip is unreliable behind Nginx Unit). Keep that file in sync here, on
// every maintenance save, so a toggle takes effect without any network call.
function maintenanceFlagPath(): string {
  const raw = (process.env.DATABASE_URL || "file:.data/ttm.db").replace(/^file:/, "");
  if (raw === ":memory:" || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return path.join(process.cwd(), ".data", "maintenance.flag");
  }
  return path.join(path.dirname(raw) || ".", "maintenance.flag");
}
function writeMaintenanceFlag(enabled: boolean): void {
  try {
    const p = maintenanceFlagPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, enabled ? "1" : "0");
  } catch { /* non-fatal: the gate just won't change until the next save */ }
}

// ---- shape -----------------------------------------------------------------
export interface SiteSettings {
  site: { name: string; tagline: string; copyrightName: string };
  contact: {
    email: string;
    phoneDisplay: string;
    phoneTel: string;
    whatsappNumber: string; // intl digits, e.g. 27780088788
    whatsappLink: string;
    addressLines: string; // one address per line (textarea)
    hours: string;
  };
  social: { facebook: string; instagram: string; tiktok: string; youtube: string };
  commerce: {
    freeDeliveryMinTyres: number;
    standardDeliveryFee: number; // minor units (cents)
    vatRate: number; // percent, e.g. 15
    vatIncluded: boolean; // prices shown incl. VAT
    happyPayMonths: number;
    roadHazardFee: number; // minor units
    timezone: string; // IANA tz for coupon/special start-end times (e.g. Africa/Johannesburg)
  };
  invoice: {
    legalName: string;   // registered business name on tax invoices
    vatNumber: string;
    regNumber: string;   // company registration number (optional)
    footer: string;      // e.g. banking details / terms, shown at the bottom
  };
  maintenance: {
    enabled: boolean; // hide the public storefront behind a "coming soon" page
    heading: string;
    message: string;
  };
  email: {
    // How the site sends email. Read at runtime (admin-editable) because the
    // self-hosted build freezes env-based config. Leave blank to use env vars.
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean; // true = port 465 SSL, false = 587 STARTTLS
    smtpUser: string;
    smtpPass: string;
    mailFrom: string;    // e.g. The Tyre Mall <shop@thetyremall.co.za>
    emailCc: string;     // comma-separated BCC/CC on every send (optional)
    resendApiKey: string; // optional: use Resend HTTP API instead of SMTP
  };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site: {
    name: "The Tyre Mall",
    tagline: "SA's Largest Online Tyre Supplier",
    copyrightName: "The Tyre Mall",
  },
  contact: {
    email: sc.SHOP_EMAIL,
    phoneDisplay: sc.SHOP_PHONE_DISPLAY,
    phoneTel: sc.SHOP_PHONE_TEL,
    whatsappNumber: sc.WHATSAPP_PHONE,
    whatsappLink: sc.WHATSAPP_LINK,
    addressLines: "31 Heronmere Road, Reuven, Johannesburg, 2091",
    hours: "Mon–Fri 8:00–17:00 · Sat 8:00–13:00",
  },
  social: { facebook: "", instagram: "", tiktok: "", youtube: "" },
  commerce: {
    freeDeliveryMinTyres: sc.FREE_DELIVERY_MIN_TYRES,
    standardDeliveryFee: sc.STANDARD_DELIVERY_FEE,
    vatRate: 15,
    vatIncluded: true,
    happyPayMonths: 2,
    roadHazardFee: sc.ROAD_HAZARD_FEE,
    timezone: "Africa/Johannesburg",
  },
  invoice: {
    legalName: "The Tyre Mall",
    vatNumber: "",
    regNumber: "",
    footer: "Thank you for your business.",
  },
  maintenance: {
    enabled: false,
    heading: "We're launching soon",
    message: "Our online store is getting its final touches. We'll be open for orders very soon — in the meantime, give us a call and our team will sort you out.",
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    mailFrom: "",
    emailCc: "",
    resendApiKey: "",
  },
};

const GROUPS = Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[];
export const SETTINGS_TAG = "settings";

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

function mergeGroup<K extends keyof SiteSettings>(key: K, stored: unknown): SiteSettings[K] {
  const base = DEFAULT_SETTINGS[key] as Record<string, unknown>;
  if (!stored || typeof stored !== "object") return DEFAULT_SETTINGS[key];
  return { ...base, ...(stored as Record<string, unknown>) } as SiteSettings[K];
}

async function readSettings(): Promise<SiteSettings> {
  try {
    await ensureTable();
    const rows = await db.select().from(schema.settings);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const out = {} as SiteSettings;
    for (const g of GROUPS) {
      let parsed: unknown = undefined;
      const raw = byKey.get(g);
      if (raw) { try { parsed = JSON.parse(raw); } catch { /* ignore */ } }
      // @ts-expect-error indexed assignment across union is safe here
      out[g] = mergeGroup(g, parsed);
    }
    return out;
  } catch (e) {
    console.error("[settings] read failed, using defaults:", (e as Error).message);
    return DEFAULT_SETTINGS;
  }
}

/** Cached site settings for storefront + admin reads (tag-revalidated on save). */
export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("max"); // changes rarely; invalidated on-demand when saved
  return readSettings();
}

/** Merge a partial patch into one or more groups and revalidate the storefront. */
export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  await ensureTable();
  const current = await readSettings();
  const now = Date.now();
  for (const g of GROUPS) {
    const p = patch[g];
    if (!p) continue;
    const merged = { ...(current[g] as Record<string, unknown>), ...(p as Record<string, unknown>) };
    await db
      .insert(schema.settings)
      .values({ key: g, value: JSON.stringify(merged), updatedAt: now })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(merged), updatedAt: now } });
    // Mirror the coming-soon flag to disk for the proxy to read (see note above).
    if (g === "maintenance") writeMaintenanceFlag(!!(merged as { enabled?: boolean }).enabled);
  }
  // On-demand invalidation of the cached settings (footer/header shell etc.).
  revalidateTag(SETTINGS_TAG, "max");
  return readSettings();
}

/** WhatsApp deep link with a prefilled message, from current settings. */
export function whatsappHref(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Current year, cached so it's prerender-safe under Cache Components. */
export async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
