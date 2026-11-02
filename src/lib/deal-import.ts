import "server-only";
import { randomUUID } from "crypto";
import { libsql } from "./db";
import { categories as SHOP_CATEGORIES } from "./catalogue";
import { getProductRow, createProduct, updateProductFields, type NewProduct, type ProductPatch } from "./db/queries";
import { parseCsv, rollbackBatch } from "./product-import";
import { getSpecial } from "./special-categories";
import { dealProductsOf, registerDealProduct, pruneDealProducts, allDealSlugs } from "./deal-products";

// CSV import of DEAL products into one special / sale category (Admin →
// Products → Special categories → a special → Import deal products). Each row
// becomes a separate product with its own SKU, price and stock, in that special
// only. Standard shop products are never changed: a row whose SKU belongs to a
// shop product is refused. Columns can be the old WooCommerce export
// (post_title, post_name, regular_price in Rand, images, attribute:pa_tyre-size…)
// or the shop's own (name, slug, price, image, tyre_size…). Anything missing is
// copied from the normal product the deal is based on (matched by
// `original_sku`, or by the row's slug / post_name).

export interface DealRowPlan {
  line: number; action: "create" | "update"; slug: string; name: string; sku: string;
  priceDisplay: string; stock: number;
  original?: { slug: string; name: string } | null;
  photo: "file" | "copied" | "missing";
  details?: string[];
}
export interface DealImportReport {
  special: string;
  total: number;
  creates: DealRowPlan[];
  updates: DealRowPlan[];
  errors: { line: number; msg: string }[];
  missingPhotos: { line: number; name: string; sku: string }[];
  committed: boolean; batchId?: string; createdCount?: number; updatedCount?: number;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
const rand = (v?: string) => { if (!v) return undefined; const n = Number(v.replace(/[Rr\s]/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined; };
const cents = (v?: string) => { if (!v) return undefined; const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : undefined; };
const int = (v?: string) => { if (!v) return undefined; const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 ? n : undefined; };

/** Shop category for a WooCommerce category name ("4x4 Tyres" → 4x4-tyres). */
const CAT_BY_NAME = new Map(SHOP_CATEGORIES.map((c) => [c.name.toLowerCase().replace(/[^a-z0-9]+/g, ""), c.slug]));
const SHOP_CAT_SLUGS = new Set(SHOP_CATEGORIES.map((c) => c.slug));

/** The old WordPress image links no longer exist on the new site. */
const deadImage = (url: string) => /\/wp-content\//i.test(url);

type Row = Record<string, string>;
const pick = (r: Row, ...keys: string[]) => { for (const k of keys) { const v = r[k]; if (v !== undefined && v.trim() !== "") return v.trim(); } return undefined; };

async function shopProductBySku(sku: string, dealSlugs: Set<string>) {
  const r = await libsql.execute({ sql: "SELECT slug, name FROM products WHERE sku = ?", args: [sku] });
  return (r.rows as Record<string, unknown>[]).map((x) => ({ slug: String(x.slug), name: String(x.name) })).find((x) => !dealSlugs.has(x.slug)) ?? null;
}

export async function runDealImport(csvText: string, specialId: number, commit: boolean): Promise<DealImportReport> {
  const special = await getSpecial(specialId);
  const report: DealImportReport = { special: special?.name ?? "", total: 0, creates: [], updates: [], errors: [], missingPhotos: [], committed: false };
  if (!special) { report.errors.push({ line: 0, msg: "That special / sale category wasn't found." }); return report; }
  const rows = parseCsv(csvText);
  report.total = rows.length;
  if (!rows.length) { report.errors.push({ line: 1, msg: "No data rows found." }); return report; }
  const woo = "post_title" in rows[0];

  const dealSlugs = await allDealSlugs();
  const mine = await dealProductsOf(special.slug); // sku → this special's deal products
  const seenSku = new Set<string>();
  const usedSlugs = new Set<string>();
  const creates: { line: number; product: NewProduct; original: string | null }[] = [];
  const updates: { line: number; slug: string; patch: ProductPatch }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const sku = pick(r, "sku");
    if (!sku) { report.errors.push({ line, msg: "Each deal product needs its own SKU." }); continue; }
    if (seenSku.has(sku)) { report.errors.push({ line, msg: `SKU ${sku} is in the file twice.` }); continue; }
    seenSku.add(sku);

    // The normal shop product this deal is based on (never changed).
    const baseSlug = slugify(pick(r, "post_name", "slug") ?? "");
    const origSku = pick(r, "original_sku");
    let original: Awaited<ReturnType<typeof getProductRow>> = null;
    if (origSku) { const o = await shopProductBySku(origSku, dealSlugs); if (o) original = await getProductRow(o.slug); }
    if (!original && baseSlug && !dealSlugs.has(baseSlug)) original = await getProductRow(baseSlug);

    // SKU must not belong to a standard shop product (or another special's deal).
    const existingDeal = mine.get(sku);
    if (!existingDeal) {
      const clash = await shopProductBySku(sku, dealSlugs);
      if (clash) { report.errors.push({ line, msg: `SKU ${sku} already belongs to the shop product “${clash.name}”. Give the deal product its own SKU (e.g. ${sku}-${special.slug.split("-").map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "DEAL"}) so the shop product isn't changed.` }); continue; }
      const otherDeal = await libsql.execute({ sql: "SELECT p.name FROM products p JOIN deal_products d ON d.slug = p.slug WHERE p.sku = ? LIMIT 1", args: [sku] }).catch(() => ({ rows: [] }));
      if (otherDeal.rows.length) { report.errors.push({ line, msg: `SKU ${sku} is already used by a deal product in another special.` }); continue; }
    }

    // Fields (WooCommerce export or the shop's own columns); blanks fall back to the normal product.
    const name = pick(r, "post_title", "name", "title") ?? original?.name;
    if (!name) { report.errors.push({ line, msg: "Needs a name (post_title / name), or an original_sku / slug of a shop product to copy it from." }); continue; }
    const regular = woo ? rand(pick(r, "regular_price")) : cents(pick(r, "regular_price")) ?? rand(pick(r, "price_retail", "price"));
    const sale = woo ? rand(pick(r, "sale_price")) : cents(pick(r, "sale_price")) ?? rand(pick(r, "price_sale"));
    const regularPrice = regular ?? original?.regularPrice;
    if (!regularPrice) { report.errors.push({ line, msg: `“${name}” needs a price (regular_price).` }); continue; }
    const stock = int(pick(r, "stock", "stock_qty")) ?? 0;
    const rawImg = woo ? (pick(r, "images") ?? "").split("|")[0].split(" ! ")[0].trim() : pick(r, "image") ?? "";
    const fileImg = rawImg && !deadImage(rawImg) && (/^https:\/\//i.test(rawImg) || rawImg.startsWith("/")) ? rawImg : "";
    const image = fileImg || original?.image || null;
    const photo: DealRowPlan["photo"] = fileImg ? "file" : image ? "copied" : "missing";
    const ospecs = (() => { try { return JSON.parse(original?.specs || "{}") as Record<string, string>; } catch { return {}; } })();
    const specs: Record<string, string> = { ...ospecs };
    for (const [k, keys] of [["size", ["attribute:pa_tyre-size", "tyre_size", "size"]], ["width", ["attribute:pa_tyre-width", "width"]], ["profile", ["attribute:pa_tyre-profile", "profile"]], ["rim", ["attribute:pa_rim-size", "rim"]], ["pcd", ["pcd"]]] as const) {
      const v = pick(r, ...keys); if (v) specs[k] = v;
    }
    const wooCats = (pick(r, "tax:product_cat") ?? "").split("|").map((c) => CAT_BY_NAME.get(c.toLowerCase().replace(/[^a-z0-9]+/g, ""))).filter((c): c is string => !!c);
    const ownCats = (pick(r, "categories") ?? "").split(/[|,]/).map((c) => c.trim()).filter((c) => SHOP_CAT_SLUGS.has(c));
    const origCats = (() => { try { return (JSON.parse(original?.categories || "[]") as string[]).filter((c) => SHOP_CAT_SLUGS.has(c)); } catch { return []; } })();
    const cats = [...new Set([...(wooCats.length ? wooCats : ownCats.length ? ownCats : origCats), special.slug])];
    const typeIn = (pick(r, "type") ?? "").toLowerCase();
    const type = typeIn === "wheel" || typeIn === "tyre" || typeIn === "other" ? typeIn
      : /wheel|mag/i.test(pick(r, "tax:product_cat") ?? "") ? "wheel" : original?.type ?? "tyre";
    const fields = {
      name, brand: pick(r, "tax:pwb-brand", "brand") ?? original?.brand ?? "", type, sku,
      regularPrice, salePrice: sale ?? 0, onSale: !!sale && sale < regularPrice,
      stockQty: stock, image, categories: cats, specs,
      shortDescription: pick(r, "post_excerpt", "short_description") ?? original?.shortDescription ?? "",
      description: pick(r, "post_content", "long_description", "description") ?? original?.description ?? "",
    };
    const price = fields.onSale ? fields.salePrice : regularPrice;
    const orig = original ? { slug: original.slug, name: original.name } : null;

    if (existingDeal) {
      // Re-import into the same special: update that deal product (asked to confirm in Admin).
      const cur = await getProductRow(existingDeal.slug);
      const details: string[] = [];
      if (cur) {
        if (cur.name !== name) details.push(`Name: “${cur.name}” → “${name}”`);
        if (cur.price !== price) details.push(`Price: ${zar(cur.price)} → ${zar(price)}`);
        if (cur.stockQty !== stock) details.push(`Stock: ${cur.stockQty} → ${stock}`);
        if ((cur.image ?? "") !== (image ?? "")) details.push("Photo changed");
        if (cur.description !== fields.description || cur.shortDescription !== fields.shortDescription) details.push("Description changed");
      }
      if (!details.length) continue; // nothing changed
      updates.push({ line, slug: existingDeal.slug, patch: { ...fields, price, categories: JSON.stringify(cats), specs: JSON.stringify(specs) } });
      report.updates.push({ line, action: "update", slug: existingDeal.slug, name, sku, priceDisplay: zar(price), stock, original: orig, photo, details });
    } else {
      // New deal product with its own address: <normal slug>-<special>.
      const base = (baseSlug || slugify(`${fields.brand} ${name}`)).slice(0, 120);
      let slug = `${base}-${special.slug}`.slice(0, 180);
      for (let n = 2; usedSlugs.has(slug) || (await getProductRow(slug)); n++) slug = `${base}-${special.slug}-${n}`.slice(0, 180);
      usedSlugs.add(slug);
      creates.push({ line, product: { slug, ...fields, lowStockThreshold: 2, visible: true }, original: orig?.slug ?? null });
      report.creates.push({ line, action: "create", slug, name, sku, priceDisplay: zar(price), stock, original: orig, photo });
    }
    if (photo === "missing") report.missingPhotos.push({ line, name, sku });
  }

  if (!commit || report.errors.length) return report;

  // ---- write, and record the batch so it can be undone ----
  await libsql.execute(`CREATE TABLE IF NOT EXISTS import_batches (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, mode TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '{}', ops TEXT NOT NULL DEFAULT '[]', rolled_back INTEGER NOT NULL DEFAULT 0)`);
  const ops: { slug: string; action: "create" | "update"; before?: Record<string, unknown> }[] = [];
  let created = 0, updated = 0;
  for (const u of updates) {
    const before = await getProductRow(u.slug);
    if (!before) continue;
    await updateProductFields(u.slug, u.patch);
    ops.push({ slug: u.slug, action: "update", before: { ...before } });
    updated++;
  }
  for (const c of creates) {
    const res = await createProduct(c.product);
    if (!res.ok) { report.errors.push({ line: c.line, msg: res.error ?? "Couldn't create this product." }); continue; }
    await registerDealProduct(c.product.slug, special.slug, c.original);
    ops.push({ slug: c.product.slug, action: "create" });
    created++;
  }
  const batchId = randomUUID();
  await libsql.execute({
    sql: "INSERT INTO import_batches (id, created_at, mode, summary, ops) VALUES (?,?,?,?,?)",
    args: [batchId, Date.now(), `deal:${special.slug}`, JSON.stringify({ created, updated }), JSON.stringify(ops)],
  });
  report.committed = true; report.batchId = batchId; report.createdCount = created; report.updatedCount = updated;
  return report;
}

/** Undo a deal import (removes the deal products it made, restores ones it changed). */
export async function rollbackDealImport(batchId: string) {
  const res = await rollbackBatch(batchId);
  await pruneDealProducts().catch(() => {});
  return res;
}

