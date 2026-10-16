import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";

// Admin-editable brand theme tokens, applied site-wide at runtime via CSS
// variables (no redeploy). Only brand colours + card radius are exposed — these
// aren't redefined by light mode, so overriding them is safe in both themes.
export interface ThemeTokens {
  volt: string; // primary brand colour
  sale: string; // sale / discount red
  pay: string; // success / BNPL green
  radiusCard: number; // px
}

export const DEFAULT_THEME: ThemeTokens = { volt: "#8ac53f", sale: "#ff3b2e", pay: "#19c37d", radiusCard: 14 };
export const THEME_TAG = "theme";

const HEX = /^#[0-9a-fA-F]{6}$/;
const clean = (v: unknown, fb: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fb);

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS theme (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '{}')`);
  ensured = true;
}

async function readTheme(): Promise<ThemeTokens> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT value FROM theme WHERE key = 'tokens' LIMIT 1");
    if (!r.rows.length) return DEFAULT_THEME;
    const t = JSON.parse(String(r.rows[0].value)) as Partial<ThemeTokens>;
    return {
      volt: clean(t.volt, DEFAULT_THEME.volt),
      sale: clean(t.sale, DEFAULT_THEME.sale),
      pay: clean(t.pay, DEFAULT_THEME.pay),
      radiusCard: typeof t.radiusCard === "number" && isFinite(t.radiusCard) ? Math.max(0, Math.min(40, Math.round(t.radiusCard))) : DEFAULT_THEME.radiusCard,
    };
  } catch { return DEFAULT_THEME; }
}

export async function getThemeRaw(): Promise<ThemeTokens> { await ensureTable(); return readTheme(); }

/** Cached theme for the root layout (tag-revalidated on save). */
export async function getTheme(): Promise<ThemeTokens> {
  "use cache";
  cacheTag(THEME_TAG);
  cacheLife("max");
  return readTheme();
}

export async function saveTheme(patch: Partial<ThemeTokens>): Promise<void> {
  await ensureTable();
  const cur = await readTheme();
  const next: ThemeTokens = {
    volt: patch.volt !== undefined ? clean(patch.volt, cur.volt) : cur.volt,
    sale: patch.sale !== undefined ? clean(patch.sale, cur.sale) : cur.sale,
    pay: patch.pay !== undefined ? clean(patch.pay, cur.pay) : cur.pay,
    radiusCard: patch.radiusCard !== undefined ? Math.max(0, Math.min(40, Math.round(Number(patch.radiusCard) || cur.radiusCard))) : cur.radiusCard,
  };
  await libsql.execute({ sql: "INSERT INTO theme (key, value) VALUES ('tokens', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify(next)] });
  revalidateTag(THEME_TAG, "max");
}

/** Darken a hex colour by `amt` (0–1) for the derived volt-2 (hover/gradient). */
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** CSS that overrides the brand tokens, only when they differ from defaults.
 *  Uses :root:root for higher specificity so it wins regardless of CSS order. */
export async function themeCss(): Promise<string> {
  const t = await getTheme();
  const decls: string[] = [];
  if (t.volt !== DEFAULT_THEME.volt) { decls.push(`--color-volt:${t.volt}`); decls.push(`--color-volt-2:${darken(t.volt, 0.2)}`); }
  if (t.sale !== DEFAULT_THEME.sale) decls.push(`--color-sale:${t.sale}`);
  if (t.pay !== DEFAULT_THEME.pay) decls.push(`--color-pay:${t.pay}`);
  if (t.radiusCard !== DEFAULT_THEME.radiusCard) decls.push(`--radius-card:${t.radiusCard}px`);
  return decls.length ? `:root:root{${decls.join(";")}}` : "";
}
