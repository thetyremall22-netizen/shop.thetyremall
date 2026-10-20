import "server-only";
import { getProducts } from "./catalogue";
import { findCategory } from "./special-categories";
import type { Product } from "./types";

/** Products for a home page row built from chosen categories: in-stock items
 *  with a picture first, mixed across the categories, no duplicates. Special or
 *  sale categories only count while they're live. */
export async function productsFromCategories(slugs: string[], limit: number): Promise<Product[]> {
  const live: string[] = [];
  for (const s of slugs) if (await findCategory(s)) live.push(s);
  if (!live.length) return [];
  const all = await getProducts();
  const lists = live.map((slug) => all
    .filter((p) => p.categories.includes(slug) && p.image)
    .sort((a, b) => Number(b.inStock) - Number(a.inStock)));
  // Take from each category in turn so every chosen category is represented.
  const out: Product[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const p = l[i];
      if (p && !seen.has(p.slug)) { seen.add(p.slug); out.push(p); if (out.length >= limit) break; }
    }
  }
  return out;
}
