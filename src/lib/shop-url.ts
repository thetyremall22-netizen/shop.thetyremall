// Shop URLs. A category listing lives at the same address the old WooCommerce
// site used — /product-category/<slug> — so existing Google Ads and search
// links land on a real page (no redirect). Any other filters ride along as
// query parameters. Everything else is /shop?….
export function categoryPath(slug: string): string {
  return `/product-category/${encodeURIComponent(slug)}`;
}

/** Brand pages live at /product-category/<brand-slug> too (e.g. /product-category/bridgestone). */
export const brandPageSlug = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export function brandPath(brand: string): string {
  return `/product-category/${brandPageSlug(brand)}`;
}

/** The Mag Wheels category (every wheel product is in it). */
export const WHEELS_CATEGORY = "mag-wheel";

export function shopHref(params: URLSearchParams | string): string {
  const p = new URLSearchParams(params);
  // "All wheels" is the Mag Wheels category page.
  if (p.get("type") === "wheel" && !p.get("category") && !p.get("q")) { p.delete("type"); p.set("category", WHEELS_CATEGORY); }
  const cat = p.get("category");
  if (cat) {
    p.delete("category");
    const qs = p.toString();
    return `${categoryPath(cat)}${qs ? `?${qs}` : ""}`;
  }
  // A brand on its own (no search words) has its own page as well.
  const brand = p.get("brand");
  if (brand && !p.get("q")) {
    p.delete("brand");
    const qs = p.toString();
    return `${brandPath(brand)}${qs ? `?${qs}` : ""}`;
  }
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}
