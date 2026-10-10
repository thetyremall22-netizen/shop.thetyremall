import "server-only";
import productsData from "@/data/products.json";
import categoriesData from "@/data/categories.json";
import metaData from "@/data/meta.json";
import type { Product, Category, CatalogueMeta } from "./types";

export const products = productsData as unknown as Product[];
export const categories = categoriesData as unknown as Category[];
export const meta = metaData as unknown as CatalogueMeta;

const bySlug = new Map(products.map((p) => [p.slug, p]));
const catBySlug = new Map(categories.map((c) => [c.slug, c]));

export function getProduct(slug: string): Product | undefined {
  return bySlug.get(slug);
}

export function getCategory(slug: string): Category | undefined {
  return catBySlug.get(slug);
}

export const primaryCategories = categories.filter((c) => c.primary);
export const dealCategories = categories.filter(
  (c) => !c.primary && /deal|special|clearance|hot|limited|november|was/i.test(c.slug)
);

export interface Query {
  q?: string;
  category?: string;
  brand?: string;
  type?: "tyre" | "wheel";
  width?: string;
  profile?: string;
  rim?: string;
  pcd?: string;
  minPrice?: number; // rands
  maxPrice?: number; // rands
  onSale?: boolean;
  sort?: "relevance" | "price-asc" | "price-desc" | "name" | "newest";
  page?: number;
  perPage?: number;
}

export interface QueryResult {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  facetBrands: { name: string; count: number }[];
}

function matchesText(p: Product, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = `${p.name} ${p.brand} ${p.sku} ${p.specs.size ?? ""}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function queryProducts(q: Query): QueryResult {
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

  // facet: brand counts within the current (pre-brand) result set
  const brandCounts = new Map<string, number>();
  for (const p of items) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const facetBrands = [...brandCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  switch (q.sort) {
    case "price-asc":
      items = items.slice().sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      items = items.slice().sort((a, b) => b.price - a.price);
      break;
    case "name":
      items = items.slice().sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "newest":
      items = items.slice().sort((a, b) => b.id - a.id);
      break;
  }

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    total,
    page,
    perPage,
    pages,
    facetBrands,
  };
}

/** Lightweight live-search for the header autocomplete. */
export function searchProducts(q: string, limit = 8): Product[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out: Product[] = [];
  for (const p of products) {
    if (matchesText(p, terms)) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function relatedProducts(p: Product, limit = 6): Product[] {
  return products
    .filter(
      (o) =>
        o.id !== p.id &&
        (o.brand === p.brand || o.categories.some((c) => p.categories.includes(c)))
    )
    .slice(0, limit);
}

export function bestSellers(limit = 10): Product[] {
  return products.filter((p) => p.inStock && p.image).slice(0, limit);
}

export function wheelProducts(limit = 12): Product[] {
  return products.filter((p) => p.type === "wheel" && p.image).slice(0, limit);
}

export function dealProducts(limit = 10): Product[] {
  const sale = products.filter((p) => p.onSale && p.image);
  return (sale.length ? sale : products.filter((p) => p.image)).slice(0, limit);
}
