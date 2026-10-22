import type { MetadataRoute } from "next";
import { getProducts, categories } from "@/lib/catalogue";
import { categoryPath, brandPath } from "@/lib/shop-url";
import { filterBrands } from "@/lib/brand-registry";
import { BLOG_POSTS } from "@/data/blog";

const BASE = "https://thetyremall.co.za";

// Top-level pages a crawler should always see. Transactional/private routes
// (cart, checkout, admin, compare) are intentionally left out — see robots.ts.
const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" },
  { path: "/product-category/tyres", priority: 0.9, changeFrequency: "daily" },
  { path: "/product-category/hot-dealz", priority: 0.8, changeFrequency: "daily" },
  { path: "/mag-wheels", priority: 0.9, changeFrequency: "weekly" },
  { path: "/vehicle-search", priority: 0.8, changeFrequency: "weekly" },
  { path: "/radar-protect", priority: 0.6, changeFrequency: "monthly" },
  { path: "/how-to-apply-for-credit-online/", priority: 0.6, changeFrequency: "monthly" },
  { path: "/delivery-areas", priority: 0.6, changeFrequency: "monthly" },
  { path: "/stores", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/returns", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: now,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));

  // Products — best effort; never let a DB hiccup produce an invalid sitemap.
  let productEntries: MetadataRoute.Sitemap = [];
  try {
    const products = await getProducts();
    productEntries = products.map((p) => ({
      url: `${BASE}/product/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    /* leave products out rather than fail the whole sitemap */
  }

  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Category listings at their original /product-category/<slug> addresses.
  const categoryEntries: MetadataRoute.Sitemap = categories.filter((c) => c.count > 0).map((c) => ({
    url: `${BASE}${categoryPath(c.slug)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: c.primary ? 0.8 : 0.6,
  }));

  let brandEntries: MetadataRoute.Sitemap = [];
  try {
    brandEntries = (await filterBrands()).map((b) => ({ url: `${BASE}${brandPath(b.name)}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 }));
  } catch { /* leave brands out rather than fail */ }

  return [...staticEntries, ...categoryEntries, ...brandEntries, ...productEntries, ...blogEntries];
}
