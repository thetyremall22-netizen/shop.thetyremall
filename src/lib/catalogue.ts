import "server-only";
import productsData from "@/data/products.json";
import categoriesData from "@/data/categories.json";
import metaData from "@/data/meta.json";
import { cacheLife } from "next/cache";
import type { Product, Category, CatalogueMeta, ProductType } from "./types";
import { db, schema } from "./db";

const snapshot = productsData as unknown as Product[];
export const categories = categoriesData as unknown as Category[];
export const meta = metaData as unknown as CatalogueMeta;

const catBySlug = new Map(categories.map((c) => [c.slug, c]));
export const primaryCategories = categories.filter((c) => c.primary);
export const dealCategories = categories.filter(
  (c) => !c.primary && /deal|special|clearance|hot|limited|november|was/i.test(c.slug)
);

export function getCategory(slug: string): Category | undefined {
  return catBySlug.get(slug);
}

// ---- live product source (DB, cached) with snapshot fallback ----------------
type Row = typeof schema.products.$inferSelect;
function rowToProduct(r: Row): Product {
  let cats: string[] = [], specs: Product["specs"] = {};
  try { cats = JSON.parse(r.categories); } catch {}
  try { specs = JSON.parse(r.specs); } catch {}
  return {
    id: r.id, name: r.name, slug: r.slug, sku: r.sku, brand: r.brand,
    type: r.type as ProductType,
    price: r.price, regularPrice: r.regularPrice, salePrice: r.salePrice, onSale: r.onSale,
    image: r.image, thumb: r.image,
    shortDescription: r.shortDescription, description: r.description,
    categories: cats, specs, inStock: r.stockQty > 0, stockQty: r.stockQty,
    rating: 0, reviews: 0,
  };
}

async function loadFromDb(): Promise<Product[] | null> {
  try {
    const rows = await db.select().from(schema.products);
    if (!rows.length) return null;
    return rows.filter((r) => r.visible).map(rowToProduct);
  } catch {
    return null;
  }
}

/** All products from the DB (cached ~1 min); falls back to the static snapshot. */
export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  return (await loadFromDb()) ?? snapshot;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  const all = await getProducts();
  return all.find((p) => p.slug === slug);
}

// ---- query / search (unchanged logic, now over the live array) --------------
export interface Query {
  q?: string; category?: string; brand?: string; type?: "tyre" | "wheel";
  width?: string; profile?: string; rim?: string; pcd?: string;
  minPrice?: number; maxPrice?: number; onSale?: boolean;
  sort?: "relevance" | "price-asc" | "price-desc" | "name" | "newest";
  page?: number; perPage?: number;
}
export interface QueryResult {
  items: Product[]; total: number; page: number; perPage: number; pages: number;
  facetBrands: { name: string; count: number }[];
}

function matchesText(p: Product, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = `${p.name} ${p.brand} ${p.sku} ${p.specs.size ?? ""}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export async function queryProducts(q: Query): Promise<QueryResult> {
  const products = await getProducts();
  const page = Math.max(1, q.page ?? 1);
  const perPage = q.perPage ?? 24;
  const terms = (q.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);

  let items = products.filter((p) => {
    if (!matchesText(p, terms)) return false;
    if (q.category && !p.categories.includes(q.category)) return false;
    if (q.brand && p.brand.toLowerCase() !== q.brand.toLowerCase()) return false;
    if (q.type && p.type !== q.type) return false;
    if (q.width && p.specs.width !== q.width) return false;
    if (q.profile && p.specs.profile !== q.profile) return false;
    if (q.rim && p.specs.rim !== q.rim) return false;
    if (q.pcd && p.specs.pcd !== q.pcd) return false;
    if (q.onSale && !p.onSale) return false;
    if (q.minPrice != null && p.price < q.minPrice * 100) return false;
    if (q.maxPrice != null && p.price > q.maxPrice * 100) return false;
    return true;
  });

  const brandCounts = new Map<string, number>();
  for (const p of items) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const facetBrands = [...brandCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  switch (q.sort) {
    case "price-asc": items = items.slice().sort((a, b) => a.price - b.price); break;
    case "price-desc": items = items.slice().sort((a, b) => b.price - a.price); break;
    case "name": items = items.slice().sort((a, b) => a.name.localeCompare(b.name)); break;
    case "newest": items = items.slice().sort((a, b) => b.id - a.id); break;
  }

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  return { items: items.slice(start, start + perPage), total, page, perPage, pages, facetBrands };
}

export async function searchProducts(q: string, limit = 8): Promise<Product[]> {
  const products = await getProducts();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out: Product[] = [];
  for (const p of products) {
    if (matchesText(p, terms)) { out.push(p); if (out.length >= limit) break; }
  }
  return out;
}

export async function relatedProducts(p: Product, limit = 6): Promise<Product[]> {
  const products = await getProducts();
  return products
    .filter((o) => o.id !== p.id && (o.brand === p.brand || o.categories.some((c) => p.categories.includes(c))))
    .slice(0, limit);
}

/** Suggested tyres: same size, different brand (item 9). Falls back to same
 *  width + rim, then same category, so the rail is never empty. */
export async function similarTyres(p: Product, limit = 8): Promise<Product[]> {
  const products = await getProducts();
  const pool = products.filter((o) => o.id !== p.id && o.type === "tyre" && o.image && o.inStock);
  const size = p.specs.size;
  const diffBrand = (o: Product) => o.brand.toLowerCase() !== p.brand.toLowerCase();

  const sameSize = size ? pool.filter((o) => o.specs.size === size && diffBrand(o)) : [];
  const sameFit = pool.filter(
    (o) => o.specs.width === p.specs.width && o.specs.rim === p.specs.rim && diffBrand(o)
  );
  const sameCat = pool.filter((o) => o.categories.some((c) => p.categories.includes(c)) && diffBrand(o));

  const out: Product[] = [];
  const seen = new Set<number>([p.id]);
  for (const list of [sameSize, sameFit, sameCat]) {
    for (const o of list) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      out.push(o);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function bestSellers(limit = 10): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.inStock && p.image).slice(0, limit);
}

export async function wheelProducts(limit = 12): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.type === "wheel" && p.image).slice(0, limit);
}

export async function dealProducts(limit = 10): Promise<Product[]> {
  const products = await getProducts();
  const sale = products.filter((p) => p.onSale && p.image);
  return (sale.length ? sale : products.filter((p) => p.image)).slice(0, limit);
}
