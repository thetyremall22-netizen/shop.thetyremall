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

/** Listing pages that are a filter rather than a stored category, so they get
 *  a clean /product-category/<slug> address too. */
export const FILTER_PAGES: Record<string, { name: string; params: Record<string, string>; canonical?: string }> = {
  tyres: { name: "Tyres", params: { type: "tyre" } },
  "hot-dealz": { name: "Hot Dealz", params: { onSale: "1" } },
  "on-sale": { name: "Hot Dealz", params: { onSale: "1" }, canonical: "hot-dealz" },
};

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
  // All tyres / everything on sale.
  if (!p.get("q") && !brand) {
    const slug = p.get("type") === "tyre" ? "tyres" : p.get("onSale") === "1" && !p.get("type") ? "hot-dealz" : null;
    if (slug) {
      for (const k of Object.keys(FILTER_PAGES[slug].params)) p.delete(k);
      const qs = p.toString();
      return `${categoryPath(slug)}${qs ? `?${qs}` : ""}`;
    }
  }
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

/** Old-style "/shop?…" links (e.g. typed into the content editor) → their clean address. */
export function cleanShopLink(href: string): string {
  const m = /^\/shop\/?\?(.*)$/.exec(href.trim());
  return m ? shopHref(m[1]) : href;
}
