/**
 * Transform the raw WooCommerce Store API dump into a trimmed catalogue
 * the Next.js app consumes. Strips heavy HTML, parses tyre specs, derives
 * brand + product type, and emits:
 *   src/data/products.json    (array of trimmed products)
 *   src/data/categories.json  (curated category list)
 *   src/data/meta.json        (brands, sizes, counts for facets)
 *
 * Usage: node scripts/build-catalogue.mjs [path-to-raw-dir]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW_DIR = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, "data-raw");
const OUT_DIR = join(ROOT, "src", "data");
mkdirSync(OUT_DIR, { recursive: true });

const rawProducts = JSON.parse(readFileSync(join(RAW_DIR, "products.json"), "utf8"));
const rawCategories = JSON.parse(readFileSync(join(RAW_DIR, "categories.json"), "utf8"));

/* ---------- helpers ---------- */
const decode = (s = "") =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#215;/g, "×")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#082;/g, "R")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&eacute;/g, "é");

const stripHtml = (html = "") =>
  decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

// Known tyre brands (first token of product name usually the brand)
const KNOWN_BRANDS = new Set([
  "RADAR", "MICHELIN", "BRIDGESTONE", "CONTINENTAL", "DUNLOP", "GOODYEAR",
  "PIRELLI", "HANKOOK", "FIRESTONE", "YOKOHAMA", "KUMHO", "FALKEN",
  "TOYO", "MAXXIS", "BFGOODRICH", "COOPER", "GENERAL", "NEXEN", "GITI",
  "SUMITOMO", "APOLLO", "WANLI", "SUNNY", "DOUBLESTAR", "LANDSAIL",
  "ROADX", "ROYALBLACK", "COMFORSER", "TRIANGLE", "LINGLONG", "AEOLUS",
  "DOUBLECOIN", "WESTLAKE", "ROADSTONE", "ACCELERA", "ZEETEX", "CST",
  "DELINTE", "DURATURN", "ROTALLA", "SAILUN", "JINYU", "GRENLANDER",
  "ILINK", "HAIDA", "BOTO", "ANNAITE", "LASSA", "GREMAX", "FORTUNE",
  "VITOUR", "OVATION", "PETLAS", "KENDA", "DICK CEPEK", "MICKEY THOMPSON",
]);

function deriveBrand(name) {
  const upper = name.toUpperCase().trim();
  // two-word brands first
  for (const b of KNOWN_BRANDS) {
    if (b.includes(" ") && upper.startsWith(b)) return titleCase(b);
  }
  const first = upper.split(/\s+/)[0];
  if (KNOWN_BRANDS.has(first)) return titleCase(first);
  return titleCase(first); // fall back to first token
}

// Wheel/mag names are messy ("MAGS 18 INCH ...") — pull a recognisable
// wheel brand/style when present, else label generically "Mag Wheel".
const WHEEL_BRANDS = [
  "BBS", "VOSSEN", "TSW", "BORBET", "XXR", "AMERICAN OUTLAW", "AMERICAN ROADSTAR",
  "KOKO KUTURE", "KOKO", "VOGUE", "VOLK RACING", "VOLK", "ROTIFORM", "ENKEI",
  "AXE", "MSW", "OZ RACING", "OZ", "RHC", "FUEL", "METHOD", "AMG", "BMW M",
  "ADVAN", "WORK", "RAYS", "RONAL", "MOMO",
];
function deriveWheelBrand(name) {
  const upper = name.toUpperCase();
  for (const b of WHEEL_BRANDS) {
    if (upper.includes(b)) return titleCase(b);
  }
  return "Mag Wheel";
}

const titleCase = (s) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Parse a tyre size like 265/60R18 or 37X12.50R17 or 7.50R18
function parseSize(name, attrs) {
  const a = {};
  for (const at of attrs || []) {
    const t = at.terms?.[0]?.name;
    if (!t) continue;
    if (at.taxonomy === "pa_tyre-width") a.width = t;
    if (at.taxonomy === "pa_tyre-profile") a.profile = t;
    if (at.taxonomy === "pa_rim-size") a.rim = t;
  }
  // metric e.g. 265/60R18
  const m = name.match(/(\d{3})\/(\d{2})\s?[RZ]?F?R?(\d{2})/i);
  if (m) {
    a.width ||= m[1];
    a.profile ||= m[2];
    a.rim ||= m[3];
    a.size ||= `${m[1]}/${m[2]}R${m[3]}`;
  }
  // flotation e.g. 37X12.50R17
  const f = name.match(/(\d{2})X(\d{1,2}\.?\d{0,2})R(\d{2})/i);
  if (f) {
    a.rim ||= f[3];
    a.size ||= `${f[1]}x${f[2]}R${f[3]}`;
  }
  return a;
}

// Parse mag-wheel attributes from messy names: rim (e.g. 18 INCH), PCD (6X139.7, 5/114).
function parseWheel(name) {
  const a = {};
  const rim = name.match(/(\d{2})\s?(?:INCH|")/i);
  if (rim) a.rim = rim[1];
  // rim width in inches, e.g. 8.5J, 9J
  const jw = name.match(/\b(\d{1,2}(?:\.\d)?)\s?J\b/i);
  if (jw) a.width = jw[1];
  // PCD = bolt count (3–8) × diameter (~98–180mm), e.g. 5x114.3, 6x139.7
  const pcd = name.match(/\b([3-8])\s?[X\/]\s?(\d{3}(?:\.\d)?)\b/);
  if (pcd) {
    const bolts = Number(pcd[1]);
    const dia = Number(pcd[2]);
    if ([3, 4, 5, 6, 8].includes(bolts) && dia >= 98 && dia <= 180) {
      a.pcd = `${bolts}x${pcd[2]}`;
    }
  }
  return a;
}

/* ---------- category curation ---------- */
// Primary shop categories (ordered) vs deal/promo buckets
const PRIMARY_SLUGS = [
  "passenger-tyres", "suv-tyres", "4x4-tyres", "uhp-tyres", "uhp",
  "commercial-tyres", "truck-bus-tyres", "runflat-tyres", "bike-tyres",
  "wheel-rims", "wheelrims", "wheels-rims",
];

const catById = new Map();
const categories = rawCategories
  .filter((c) => c.count > 0 && c.slug !== "uncategorized")
  .map((c) => {
    const cat = {
      id: c.id,
      name: decode(c.name),
      slug: c.slug,
      count: c.count,
      image: c.image?.src || null,
      primary: PRIMARY_SLUGS.includes(c.slug),
    };
    catById.set(c.id, cat);
    return cat;
  })
  .sort((a, b) => b.count - a.count);

/* ---------- products ---------- */
const brandCounts = new Map();
const widthSet = new Set();
const profileSet = new Set();
const rimSet = new Set();
const pcdSet = new Set();
const wheelRimSet = new Set();
const wheelWidthSet = new Set();
const wheelBrandSet = new Set();

const products = rawProducts
  .filter((p) => p.type === "simple" && p.is_purchasable !== false)
  .map((p) => {
    const name = decode(p.name);
    const catSlugs = (p.categories || []).map((c) => c.slug);
    const isWheel =
      catSlugs.some((s) => s.includes("wheel") || s.includes("mag")) ||
      /\b(mag|mags|rim|wheel)\b/i.test(name);
    const specs = isWheel ? parseWheel(name) : parseSize(name, p.attributes);
    const brand = isWheel ? deriveWheelBrand(name) : deriveBrand(name);
    const price = Number(p.prices?.price || 0); // minor units (cents)
    const regular = Number(p.prices?.regular_price || price);
    const sale = Number(p.prices?.sale_price || price);

    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    if (isWheel) {
      if (specs.rim) wheelRimSet.add(specs.rim);
      if (specs.pcd) pcdSet.add(specs.pcd);
      if (specs.width) wheelWidthSet.add(specs.width);
      wheelBrandSet.add(brand);
    } else {
      if (specs.width) widthSet.add(specs.width);
      if (specs.profile) profileSet.add(specs.profile);
      if (specs.rim) rimSet.add(specs.rim);
    }

    return {
      id: p.id,
      name,
      slug: p.slug,
      sku: p.sku || "",
      brand,
      type: isWheel ? "wheel" : "tyre",
      price,
      regularPrice: regular,
      salePrice: sale,
      onSale: !!p.on_sale,
      image: p.images?.[0]?.src || null,
      thumb: p.images?.[0]?.thumbnail || p.images?.[0]?.src || null,
      shortDescription: stripHtml(p.short_description).slice(0, 320),
      description: stripHtml(p.description),
      categories: catSlugs,
      specs,
      inStock: p.is_in_stock !== false,
      stockQty:
        typeof p.low_stock_remaining === "number"
          ? p.low_stock_remaining
          : (p.stock_availability?.text?.match(/\d+/)?.[0]
              ? Number(p.stock_availability.text.match(/\d+/)[0])
              : null),
      rating: Number(p.average_rating || 0),
      reviews: Number(p.review_count || 0),
    };
  });

const sortNum = (a, b) => Number(a) - Number(b);
const meta = {
  productCount: products.length,
  brands: [...brandCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count),
  widths: [...widthSet].sort(sortNum),
  profiles: [...profileSet].sort(sortNum),
  rims: [...rimSet].sort(sortNum),
  wheelRims: [...wheelRimSet].sort(sortNum),
  wheelWidths: [...wheelWidthSet].sort(sortNum),
  wheelBrands: [...wheelBrandSet].sort(),
  pcds: [...pcdSet].sort(),
  generatedAt: new Date().toISOString(),
};

writeFileSync(join(OUT_DIR, "products.json"), JSON.stringify(products));
writeFileSync(join(OUT_DIR, "categories.json"), JSON.stringify(categories, null, 2));
writeFileSync(join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));

console.log(`✔ products: ${products.length}`);
console.log(`✔ categories: ${categories.length}`);
console.log(`✔ brands: ${meta.brands.length}, widths: ${meta.widths.length}, rims: ${meta.rims.length}`);
console.log(`  top brands: ${meta.brands.slice(0, 8).map((b) => `${b.name}(${b.count})`).join(", ")}`);
