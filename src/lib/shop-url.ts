// Shop URLs. A category listing lives at the same address the old WooCommerce
// site used — /product-category/<slug> — so existing Google Ads and search
// links land on a real page (no redirect). Any other filters ride along as
// query parameters. Everything else is /shop?….
export function categoryPath(slug: string): string {
  return `/product-category/${encodeURIComponent(slug)}`;
}

export function shopHref(params: URLSearchParams | string): string {
  const p = new URLSearchParams(params);
  const cat = p.get("category");
  if (cat) {
    p.delete("category");
    const qs = p.toString();
    return `${categoryPath(cat)}${qs ? `?${qs}` : ""}`;
  }
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}
