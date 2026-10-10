/** Seed src/data so the app runs before the full scrape finishes.
 * Reuses the already-scraped categories.json; adds a sample of real products. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "src", "data");
mkdirSync(OUT, { recursive: true });

const RAW_CATS = process.argv[2];
const PRIMARY = ["passenger-tyres","suv-tyres","4x4-tyres","uhp-tyres","commercial-tyres","truck-bus-tyres","runflat-tyres","bike-tyres","wheel-rims"];

let categories = [];
try {
  const raw = JSON.parse(readFileSync(RAW_CATS, "utf8"));
  categories = raw
    .filter((c) => c.count > 0 && c.slug !== "uncategorized")
    .map((c) => ({
      id: c.id,
      name: c.name.replace(/&amp;/g, "&").replace(/&#215;/g, "×"),
      slug: c.slug,
      count: c.count,
      image: c.image?.src || null,
      primary: PRIMARY.includes(c.slug),
    }))
    .sort((a, b) => b.count - a.count);
} catch {
  categories = PRIMARY.map((slug, i) => ({
    id: i + 1, name: slug.replace(/-/g, " "), slug, count: 100, image: null, primary: true,
  }));
}

const IMG = "https://thetyremall.co.za/wp-content/uploads/radar-rt.jpg";
const mk = (id, name, slug, sku, brand, type, price, cats, specs, img = null, onSale = false, regular = 0) => ({
  id, name, slug, sku, brand, type,
  price, regularPrice: regular || price, salePrice: price, onSale,
  image: img, thumb: img,
  shortDescription: `${brand} ${name} — premium ${type} available online at The Tyre Mall with fast nationwide delivery.`,
  description: `${brand} ${name}. Buy online at The Tyre Mall with free delivery on 2 or more tyres and optional fitment at a Johannesburg partner centre.`,
  categories: cats, specs, inStock: true, stockQty: 50, rating: 0, reviews: 0,
});

const products = [
  mk(65725, "RADAR 265/60R18 119/116Q Renegade R/T+", "radar-265-60r18-renegade-r-t-119-116q", "TRND0088", "Radar", "tyre", 422900, ["4x4-tyres"], { width: "265", profile: "60", rim: "18", size: "265/60R18" }, IMG),
  mk(65730, "RADAR 37X13.50R17 Renegade R/T+", "radar-37x13-50r17-121q-renegade-r-t", "TRND0090", "Radar", "tyre", 717800, ["4x4-tyres"], { width: "37", profile: "", rim: "17", size: "37x13.50R17" }, IMG),
  mk(65740, "RADAR 285/75R16 126/123K Renegade M/T", "radar-285-75r16-renegade-r7-m-t-126-123k-owl", "TRND0092", "Radar", "tyre", 452400, ["4x4-tyres"], { width: "285", profile: "75", rim: "16", size: "285/75R16" }, IMG),
  mk(65750, "RADAR 265/70R17 115H Renegade A/T-5", "radar-265-70r17-renegade-at-5-115h-owl", "TRND0094", "Radar", "tyre", 309000, ["4x4-tyres","suv-tyres"], { width: "265", profile: "70", rim: "17", size: "265/70R17" }, IMG),
  mk(70010, "MICHELIN 265/50YR19 Latitude Sport", "michelin-265-50yr19-latitude-sport", "TMIC0101", "Michelin", "tyre", 555300, ["suv-tyres","uhp-tyres"], { width: "265", profile: "50", rim: "19", size: "265/50R19" }),
  mk(70020, "MICHELIN 7.50R18 Super Vigne 102 A8", "michelin-7-50r18-super-vigne-102-a8", "TMIC0102", "Michelin", "tyre", 297200, ["commercial-tyres"], { width: "", profile: "", rim: "18", size: "7.50R18" }, null, true, 339600),
  mk(70110, "BRIDGESTONE 205/55R16 Turanza T005", "bridgestone-205-55r16-turanza-t005", "TBRI0110", "Bridgestone", "tyre", 189900, ["passenger-tyres"], { width: "205", profile: "55", rim: "16", size: "205/55R16" }),
  mk(70120, "BRIDGESTONE 225/45R17 Potenza RE003", "bridgestone-225-45r17-potenza-re003", "TBRI0120", "Bridgestone", "tyre", 234900, ["uhp-tyres"], { width: "225", profile: "45", rim: "17", size: "225/45R17" }, null, true, 259900),
  mk(70210, "CONTINENTAL 195/65R15 UltraContact UC6", "continental-195-65r15-ultracontact-uc6", "TCON0210", "Continental", "tyre", 149900, ["passenger-tyres"], { width: "195", profile: "65", rim: "15", size: "195/65R15" }),
  mk(70220, "CONTINENTAL 235/55R19 CrossContact", "continental-235-55r19-crosscontact", "TCON0220", "Continental", "tyre", 329900, ["suv-tyres"], { width: "235", profile: "55", rim: "19", size: "235/55R19" }),
  mk(70310, "GOODYEAR 215/60R16 EfficientGrip", "goodyear-215-60r16-efficientgrip", "TGOO0310", "Goodyear", "tyre", 179900, ["passenger-tyres"], { width: "215", profile: "60", rim: "16", size: "215/60R16" }),
  mk(70320, "DUNLOP 265/65R17 Grandtrek AT5", "dunlop-265-65r17-grandtrek-at5", "TDUN0320", "Dunlop", "tyre", 289900, ["4x4-tyres"], { width: "265", profile: "65", rim: "17", size: "265/65R17" }),
  mk(70410, "PIRELLI 245/40R18 P Zero", "pirelli-245-40r18-p-zero", "TPIR0410", "Pirelli", "tyre", 419900, ["uhp-tyres"], { width: "245", profile: "40", rim: "18", size: "245/40R18" }, null, true, 469900),
  mk(70420, "HANKOOK 225/50R17 Ventus Prime", "hankook-225-50r17-ventus-prime", "THAN0420", "Hankook", "tyre", 199900, ["uhp-tyres","passenger-tyres"], { width: "225", profile: "50", rim: "17", size: "225/50R17" }),
  mk(80010, "AXE WHEELS 18\" EX30 Gloss Black Mag", "axe-ex30-18-gloss-black", "TMAG0010", "Axe", "wheel", 329900, ["wheel-rims"], { rim: "18" }),
  mk(80020, "MSW 19\" Type 48 Matt Titanium Mag", "msw-type-48-19-matt-titanium", "TMAG0020", "Msw", "wheel", 389900, ["wheel-rims"], { rim: "19" }),
  mk(80030, "TSW 20\" Nurburgring Mag Wheel", "tsw-nurburgring-20", "TMAG0030", "Tsw", "wheel", 459900, ["wheel-rims"], { rim: "20" }, null, true, 519900),
  mk(90010, "RADAR 90/90-18 Bike Tyre", "radar-90-90-18-bike", "TBIK0010", "Radar", "tyre", 89900, ["bike-tyres"], { rim: "18" }),
];

const brandCounts = new Map();
const widthSet = new Set(), profileSet = new Set(), rimSet = new Set();
for (const p of products) {
  brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  if (p.specs.width) widthSet.add(p.specs.width);
  if (p.specs.profile) profileSet.add(p.specs.profile);
  if (p.specs.rim) rimSet.add(p.specs.rim);
}
const num = (a, b) => Number(a) - Number(b);
const meta = {
  productCount: products.length,
  brands: [...brandCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  widths: [...widthSet].sort(num),
  profiles: [...profileSet].sort(num),
  rims: [...rimSet].sort(num),
  generatedAt: new Date().toISOString(),
  seed: true,
};

writeFileSync(join(OUT, "products.json"), JSON.stringify(products));
writeFileSync(join(OUT, "categories.json"), JSON.stringify(categories, null, 2));
writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
console.log(`seed: ${products.length} products, ${categories.length} categories`);
