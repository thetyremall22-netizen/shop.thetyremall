import "server-only";
import { randomUUID } from "crypto";
import { libsql } from "./db";
import { getProductRow, createProduct, updateProductFields, deleteProduct, type NewProduct, type ProductPatch } from "./db/queries";

export type ImportMode = "upsert" | "create" | "update";

// ---- CSV parsing ------------------------------------------------------------
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

// ---- field helpers ----------------------------------------------------------
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const has = (r: Record<string, string>, ...keys: string[]) => keys.some((k) => k in r);
const val = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (k in r) return r[k]; return undefined; };
const bool = (v?: string) => (v === undefined || v.trim() === "" ? undefined : /^(1|true|yes|y|on|published|active)$/i.test(v.trim()));
function cents(v: string | undefined, rand: boolean): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const num = Number(v.replace(/[Rr\s]/g, "").replace(",", "."));
  if (!isFinite(num)) return NaN;
  return Math.max(0, Math.round(rand ? num * 100 : num));
}
const intOf = (v?: string) => { if (v === undefined || v.trim() === "") return undefined; const n = Math.round(Number(v)); return isFinite(n) ? Math.max(0, n) : NaN; };
const splitList = (v?: string) => (v ? v.split(/[|,]/).map((s) => s.trim()).filter(Boolean) : []);

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

// ---- report types -----------------------------------------------------------
export interface ImportRowPlan { line: number; slug: string; name: string; action: "create" | "update"; priceDisplay?: string; changed?: string[] }
export interface ImportReport {
  mode: ImportMode;
  total: number;
  creates: ImportRowPlan[];
  updates: ImportRowPlan[];
  skips: { line: number; reason: string }[];
  errors: { line: number; msg: string }[];
  committed: boolean;
  batchId?: string;
  createdCount?: number;
  updatedCount?: number;
}

interface Parsed {
  slug?: string; sku?: string; name?: string; brand?: string; type?: string;
  regularPrice?: number; salePrice?: number; onSale?: boolean;
  stockQty?: number; lowStockThreshold?: number; visible?: boolean;
  categories?: string[]; shortDescription?: string; description?: string; image?: string;
  specs?: Record<string, string>;
  provided: Set<string>;
  bad: string[]; // field parse errors
}

function parseRow(r: Record<string, string>): Parsed {
  const p: Parsed = { provided: new Set(), bad: [] };
  const num = (field: string, v: number | undefined, label: string) => { if (v === undefined) return; if (Number.isNaN(v)) { p.bad.push(`${label} is not a number`); return; } (p as unknown as Record<string, unknown>)[field] = v; p.provided.add(field); };
  // Non-empty value for any of the given header aliases, else undefined.
  // (A column that exists but is BLANK for this row means "leave unchanged".)
  const g = (...keys: string[]) => { const v = val(r, ...keys); return v !== undefined && v.trim() !== "" ? v.trim() : undefined; };

  const slug = g("slug"); if (slug) p.slug = slugify(slug);
  const sku = g("sku"); if (sku) p.sku = sku;
  const name = g("name", "title"); if (name) { p.name = name; p.provided.add("name"); }
  const brand = g("brand"); if (brand) { p.brand = brand; p.provided.add("brand"); }
  const type = g("type"); if (type) { const t = type.toLowerCase(); p.type = t === "wheel" ? "wheel" : t === "accessory" ? "accessory" : "tyre"; p.provided.add("type"); }

  // prices: *_price columns are cents (export round-trip); price_retail/price/price_sale are Rand
  if (g("regular_price") !== undefined) num("regularPrice", cents(g("regular_price"), false), "regular_price");
  else if (g("price_retail", "price") !== undefined) num("regularPrice", cents(g("price_retail", "price"), true), "price");
  if (g("sale_price") !== undefined) num("salePrice", cents(g("sale_price"), false), "sale_price");
  else if (g("price_sale") !== undefined) num("salePrice", cents(g("price_sale"), true), "price_sale");

  const onSale = bool(g("on_sale")); if (onSale !== undefined) { p.onSale = onSale; p.provided.add("onSale"); }
  if (g("stock", "stock_qty") !== undefined) num("stockQty", intOf(g("stock", "stock_qty")), "stock");
  if (g("low_stock_threshold") !== undefined) num("lowStockThreshold", intOf(g("low_stock_threshold")), "low_stock_threshold");
  const vis = bool(g("visible") ?? g("status")); if (vis !== undefined) { p.visible = vis; p.provided.add("visible"); }
  const cats = g("categories", "category"); if (cats !== undefined) { p.categories = splitList(cats); p.provided.add("categories"); }
  const sd = g("short_description"); if (sd !== undefined) { p.shortDescription = sd; p.provided.add("shortDescription"); }
  const desc = g("description"); if (desc !== undefined) { p.description = desc; p.provided.add("description"); }
  const img = g("image", "image_urls"); if (img) { p.image = img.split("|")[0].trim() || undefined; p.provided.add("image"); }

  const specs: Record<string, string> = {};
  for (const [k, col] of [["width", "width_mm,width"], ["profile", "profile_pct,profile"], ["rim", "rim_inch,rim"], ["pcd", "pcd"]] as const) {
    const v = val(r, ...col.split(","));
    if (v) specs[k] = v;
  }
  if (Object.keys(specs).length) { p.specs = specs; p.provided.add("specs"); }

  return p;
}

// ---- batch store (for rollback) --------------------------------------------
let ensured = false;
async function ensureBatchTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    mode TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '{}',
    ops TEXT NOT NULL DEFAULT '[]',
    rolled_back INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

type Op = { slug: string; action: "create" | "update"; before?: Record<string, unknown> };
type ExistingProduct = { slug: string; name: string; regularPrice: number; salePrice: number; onSale: boolean; specs: string };

// ---- plan + commit ----------------------------------------------------------
export async function runImport(csvText: string, mode: ImportMode, commit: boolean): Promise<ImportReport> {
  const rows = parseCsv(csvText);
  const report: ImportReport = { mode, total: rows.length, creates: [], updates: [], skips: [], errors: [], committed: false };
  if (!rows.length) { report.errors.push({ line: 1, msg: "No data rows found." }); return report; }
  if (!("slug" in rows[0]) && !("sku" in rows[0])) { report.errors.push({ line: 1, msg: "CSV must include a 'slug' or 'sku' column." }); return report; }

  const seen = new Set<string>();
  // Build the plan first (validate the WHOLE file before any write).
  const createPlans: { line: number; product: NewProduct }[] = [];
  const updatePlans: { line: number; slug: string; name: string; patch: ProductPatch; changed: string[] }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const line = i + 2; // header is line 1
    const p = parseRow(rows[i]);
    if (p.bad.length) { report.errors.push({ line, msg: p.bad.join("; ") }); continue; }
    if (!p.slug && !p.sku) { report.errors.push({ line, msg: "Row has no slug or sku to match on." }); continue; }

    // resolve existing (by slug, then sku)
    let existing: ExistingProduct | null = p.slug ? (await getProductRow(p.slug)) as unknown as ExistingProduct | null : null;
    if (!existing && p.sku) existing = await getProductBySku(p.sku);
    const key = p.slug || p.sku || String(line);
    if (seen.has(key)) { report.errors.push({ line, msg: `Duplicate ${p.slug ? "slug" : "sku"} "${key}" earlier in file.` }); continue; }
    seen.add(key);

    if (existing) {
      if (mode === "create") { report.skips.push({ line, reason: `"${existing.name}" already exists (create-only mode).` }); continue; }
      const patch: ProductPatch = {};
      const changed: string[] = [];
      const set = <K extends keyof ProductPatch>(k: K, v: ProductPatch[K], label: string) => { if (v !== undefined) { patch[k] = v; changed.push(label); } };
      if (p.provided.has("name")) set("name", p.name, "name");
      if (p.provided.has("brand")) set("brand", p.brand, "brand");
      if (p.provided.has("type")) set("type", p.type, "type");
      if (p.sku) set("sku", p.sku, "sku");
      if (p.provided.has("regularPrice")) set("regularPrice", p.regularPrice, "price");
      if (p.provided.has("salePrice")) set("salePrice", p.salePrice, "sale price");
      if (p.provided.has("onSale")) set("onSale", p.onSale, "on sale");
      if (p.provided.has("stockQty")) set("stockQty", p.stockQty, "stock");
      if (p.provided.has("lowStockThreshold")) set("lowStockThreshold", p.lowStockThreshold, "low-stock");
      if (p.provided.has("visible")) set("visible", p.visible, "visible");
      if (p.provided.has("categories")) set("categories", JSON.stringify(p.categories), "categories");
      if (p.provided.has("image")) set("image", p.image ?? null, "image");
      if (p.provided.has("shortDescription")) set("shortDescription", p.shortDescription, "short desc");
      if (p.provided.has("description")) set("description", p.description, "description");
      if (p.provided.has("specs")) set("specs", JSON.stringify({ ...(safeJson(existing.specs) ?? {}), ...p.specs }), "specs");
      // keep price consistent with sale state
      const reg = patch.regularPrice ?? existing.regularPrice;
      const sale = patch.salePrice ?? existing.salePrice;
      const onSale = patch.onSale ?? existing.onSale;
      patch.price = onSale && sale > 0 && sale < reg ? sale : reg;
      if (!changed.length) { report.skips.push({ line, reason: `No changes for "${existing.name}".` }); continue; }
      updatePlans.push({ line, slug: existing.slug, name: existing.name, patch, changed });
      report.updates.push({ line, slug: existing.slug, name: existing.name, action: "update", changed, priceDisplay: zar(patch.price) });
    } else {
      if (mode === "update") { report.skips.push({ line, reason: `No existing product for ${p.slug || p.sku} (update-only mode).` }); continue; }
      // create: need a name and a price
      if (!p.name) { report.errors.push({ line, msg: "New product needs a name/title." }); continue; }
      if (p.regularPrice === undefined || p.regularPrice <= 0) { report.errors.push({ line, msg: `New product "${p.name}" needs a regular price.` }); continue; }
      const slug = p.slug || slugify(`${p.brand ?? ""} ${p.name}`) || slugify(p.name);
      const onSale = p.onSale ?? (p.salePrice !== undefined && p.salePrice > 0 && p.salePrice < p.regularPrice);
      const product: NewProduct = {
        slug, name: p.name, brand: p.brand ?? "", type: p.type ?? "tyre", sku: p.sku ?? "",
        regularPrice: p.regularPrice, salePrice: p.salePrice, onSale,
        stockQty: p.stockQty ?? 0, lowStockThreshold: p.lowStockThreshold ?? 4,
        image: p.image ?? null, categories: p.categories ?? [], specs: p.specs ?? {},
        shortDescription: p.shortDescription ?? "", description: p.description ?? "", visible: p.visible ?? true,
      };
      createPlans.push({ line, product });
      report.creates.push({ line, slug, name: p.name, action: "create", priceDisplay: zar(p.regularPrice) });
    }
  }

  if (!commit || report.errors.length) return report; // dry-run, or refuse to write when any row errored

  // ---- write + record batch for rollback ----
  await ensureBatchTable();
  const ops: Op[] = [];
  let created = 0, updated = 0;
  for (const u of updatePlans) {
    const before = await getProductRow(u.slug);
    if (!before) continue;
    await updateProductFields(u.slug, u.patch);
    ops.push({ slug: u.slug, action: "update", before: { ...before } });
    updated++;
  }
  for (const c of createPlans) {
    const res = await createProduct(c.product);
    if (res.ok) { ops.push({ slug: c.product.slug, action: "create" }); created++; }
    else report.errors.push({ line: c.line, msg: res.error ?? "create failed" });
  }
  const batchId = randomUUID();
  await libsql.execute({
    sql: "INSERT INTO import_batches (id, created_at, mode, summary, ops) VALUES (?,?,?,?,?)",
    args: [batchId, Date.now(), mode, JSON.stringify({ created, updated }), JSON.stringify(ops)],
  });
  report.committed = true;
  report.batchId = batchId;
  report.createdCount = created;
  report.updatedCount = updated;
  return report;
}

// ---- rollback ---------------------------------------------------------------
const PROD_COLS = ["name", "brand", "type", "sku", "price", "regular_price", "sale_price", "on_sale", "stock_qty", "low_stock_threshold", "image", "categories", "specs", "short_description", "description", "visible", "updated_at"] as const;
const FIELD_BY_COL: Record<string, string> = { name: "name", brand: "brand", type: "type", sku: "sku", price: "price", regular_price: "regularPrice", sale_price: "salePrice", on_sale: "onSale", stock_qty: "stockQty", low_stock_threshold: "lowStockThreshold", image: "image", categories: "categories", specs: "specs", short_description: "shortDescription", description: "description", visible: "visible", updated_at: "updatedAt" };

export async function rollbackBatch(batchId: string): Promise<{ ok: boolean; error?: string; restored?: number; deleted?: number }> {
  try {
    await ensureBatchTable();
    const r = await libsql.execute({ sql: "SELECT * FROM import_batches WHERE id = ? LIMIT 1", args: [batchId] });
    if (!r.rows.length) return { ok: false, error: "That import batch was not found." };
    const row = r.rows[0] as unknown as Record<string, unknown>;
    if (Number(row.rolled_back) === 1) return { ok: false, error: "This import has already been undone." };
    const ops = JSON.parse(String(row.ops)) as Op[];
    let restored = 0, deleted = 0;
    for (const op of ops) {
      if (op.action === "create") { await deleteProduct(op.slug); deleted++; }
      else if (op.action === "update" && op.before) {
        const sets: string[] = [];
        const args: (string | number | null)[] = [];
        for (const col of PROD_COLS) {
          let v = op.before[FIELD_BY_COL[col]];
          if (typeof v === "boolean") v = v ? 1 : 0;
          sets.push(`${col} = ?`);
          args.push(v as string | number | null);
        }
        args.push(op.slug);
        await libsql.execute({ sql: `UPDATE products SET ${sets.join(", ")} WHERE slug = ?`, args });
        restored++;
      }
    }
    await libsql.execute({ sql: "UPDATE import_batches SET rolled_back = 1 WHERE id = ?", args: [batchId] });
    return { ok: true, restored, deleted };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- small helpers that need the DB ----------------------------------------
async function getProductBySku(sku: string) {
  try {
    const r = await libsql.execute({ sql: "SELECT * FROM products WHERE sku = ? LIMIT 1", args: [sku] });
    if (!r.rows.length) return null;
    const row = r.rows[0] as unknown as Record<string, unknown>;
    // shape like a ProductRow enough for our use (slug, name, regularPrice, salePrice, onSale, specs)
    return {
      slug: String(row.slug), name: String(row.name), regularPrice: Number(row.regular_price),
      salePrice: Number(row.sale_price), onSale: Number(row.on_sale) === 1, specs: String(row.specs ?? "{}"),
    } as { slug: string; name: string; regularPrice: number; salePrice: number; onSale: boolean; specs: string };
  } catch { return null; }
}
function safeJson(s: string): Record<string, string> | null { try { return JSON.parse(s); } catch { return null; } }
