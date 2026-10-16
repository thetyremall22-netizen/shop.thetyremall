import "server-only";
import crypto from "crypto";
import { libsql } from "./db";

// Encrypted-at-rest gateway credentials + a registry of supported gateways.
// The admin Settings → Payments screen reads/writes config here; the actual
// payment adapters (payfast.ts, happypay.ts) read the decrypted runtime config.

export type GatewayMode = "test" | "live";

export interface GatewayField { name: string; label: string; secret?: boolean; help?: string }
export interface GatewayMeta {
  key: string;
  label: string;
  description: string;
  capabilities: string[];
  fields: GatewayField[];
  implemented: boolean; // false = adapter is a skeleton (config stored, not yet usable)
}

export const GATEWAYS: GatewayMeta[] = [
  {
    key: "payfast", label: "PayFast",
    description: "Cards, Instant EFT, SnapScan and Mobicred via PayFast.",
    capabilities: ["card", "instant_eft", "snapscan", "mobicred"], implemented: true,
    fields: [
      { name: "merchantId", label: "Merchant ID" },
      { name: "merchantKey", label: "Merchant Key", secret: true },
      { name: "passphrase", label: "Passphrase", secret: true, help: "Set the same value in your PayFast dashboard (Settings → Integration)." },
    ],
  },
  {
    key: "happypay", label: "HappyPay",
    description: "Buy now, pay later — no upfront, split over months at 0%. Customer is redirected to HappyPay to apply; we confirm via webhook.",
    capabilities: ["bnpl"], implemented: true,
    fields: [
      { name: "merchantId", label: "Merchant ID" },
      { name: "apiKey", label: "API key", secret: true },
      { name: "webhookSecret", label: "Webhook secret", secret: true, help: "A random secret you make up — it's added to the webhook URLs so only HappyPay can call them." },
      { name: "months", label: "Instalment months (display)", help: "e.g. 2" },
    ],
  },
  {
    key: "eft", label: "Manual EFT",
    description: "Bank transfer with proof of payment, approved manually in Orders.",
    capabilities: ["eft"], implemented: true,
    fields: [
      { name: "bankName", label: "Bank" },
      { name: "accountName", label: "Account name" },
      { name: "accountNumber", label: "Account number" },
      { name: "branchCode", label: "Branch code" },
    ],
  },
];

export function gatewayMeta(key: string): GatewayMeta | undefined {
  return GATEWAYS.find((g) => g.key === key);
}

// ---- encryption (AES-256-GCM, key derived from SESSION_SECRET) --------------
const KEY = crypto.scryptSync(process.env.SESSION_SECRET || "ttm-dev-payments-key-change-me", "ttm-payments-v1", 32);
function enc(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}
function dec(blob: string): string | null {
  try {
    const [ivB, tagB, ctB] = blob.split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
    d.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([d.update(Buffer.from(ctB, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

// ---- store ------------------------------------------------------------------
let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS payment_gateways (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    mode TEXT NOT NULL DEFAULT 'test',
    config_enc TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

interface GatewayRow { enabled: boolean; mode: GatewayMode; config: Record<string, string> }

async function readRow(key: string): Promise<GatewayRow | null> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM payment_gateways WHERE key = ? LIMIT 1", args: [key] });
    if (!r.rows.length) return null;
    const row = r.rows[0] as unknown as Record<string, unknown>;
    let config: Record<string, string> = {};
    if (row.config_enc) { const d = dec(String(row.config_enc)); if (d) { try { config = JSON.parse(d); } catch { /* ignore */ } } }
    return { enabled: Number(row.enabled) === 1, mode: (String(row.mode) as GatewayMode) || "test", config };
  } catch (e) { console.error("[payments] readRow failed:", (e as Error).message); return null; }
}

/** Decrypted runtime config for an adapter (server-side only). */
export async function getGatewayRuntime(key: string): Promise<{ enabled: boolean; mode: GatewayMode; config: Record<string, string> } | null> {
  return readRow(key);
}

/** Save config for a gateway. Secret fields left blank KEEP their current value. */
export async function saveGateway(key: string, input: { enabled?: boolean; mode?: GatewayMode; config?: Record<string, string> }): Promise<{ ok: boolean; error?: string }> {
  const meta = gatewayMeta(key);
  if (!meta) return { ok: false, error: "Unknown gateway." };
  await ensureTable();
  const existing = (await readRow(key)) ?? { enabled: false, mode: "test" as GatewayMode, config: {} };
  const merged: Record<string, string> = { ...existing.config };
  if (input.config) {
    for (const f of meta.fields) {
      const v = input.config[f.name];
      if (v === undefined) continue;
      if (f.secret && v.trim() === "") continue; // blank secret = keep existing
      if (v.trim() === "") delete merged[f.name]; else merged[f.name] = v.trim();
    }
  }
  const enabled = input.enabled ?? existing.enabled;
  const mode = input.mode ?? existing.mode;
  const now = Date.now();
  await libsql.execute({
    sql: `INSERT INTO payment_gateways (key, enabled, mode, config_enc, updated_at) VALUES (?,?,?,?,?)
          ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled, mode=excluded.mode, config_enc=excluded.config_enc, updated_at=excluded.updated_at`,
    args: [key, enabled ? 1 : 0, mode, enc(JSON.stringify(merged)), now],
  });
  return { ok: true };
}

export interface GatewayStatus {
  key: string; label: string; description: string; capabilities: string[]; implemented: boolean;
  enabled: boolean; mode: GatewayMode;
  fields: { name: string; label: string; secret: boolean; help?: string; value: string; isSet: boolean }[];
}

/** For the admin screen — never returns secret values (only whether they're set). */
export async function listGatewayStatus(): Promise<GatewayStatus[]> {
  const out: GatewayStatus[] = [];
  for (const g of GATEWAYS) {
    const row = await readRow(g.key);
    out.push({
      key: g.key, label: g.label, description: g.description, capabilities: g.capabilities, implemented: g.implemented,
      enabled: row?.enabled ?? false, mode: row?.mode ?? "test",
      fields: g.fields.map((f) => {
        const current = row?.config[f.name] ?? "";
        return { name: f.name, label: f.label, secret: !!f.secret, help: f.help, value: f.secret ? "" : current, isSet: !!current };
      }),
    });
  }
  return out;
}
