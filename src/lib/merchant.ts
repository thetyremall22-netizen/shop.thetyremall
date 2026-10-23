import type { Product } from "./types";

// Google Merchant Center: one place for how a product is described to Google,
// used by the product feed (/feeds/google-merchant.xml) and the product pages'
// structured data, so the two always agree (Google compares them).

export const SITE = "https://thetyremall.co.za";

/** Same IDs Google for WooCommerce used ("gla_<WooCommerce product ID>"), so
 *  existing Merchant Center / Google Ads history carries straight over. */
export const merchantId = (p: Product) => `gla_${p.id}`;

export const absUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE}${path.startsWith("/") ? "" : "/"}${path}`);

/** Google's own category names. */
export const googleCategory = (p: Product) =>
  p.type === "wheel"
    ? "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Rims & Wheels > Automotive Rims & Wheels"
    : "Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > Motor Vehicle Wheel Systems > Motor Vehicle Tires > Automotive Tires";

/** The real brand (a few products are listed under "Tyre Mall"; their name starts with the brand). */
export function merchantBrand(p: Product): string {
  if (p.brand && !/^tyre mall$/i.test(p.brand)) return p.brand;
  const w = p.name.trim().split(/\s+/)[0] ?? "";
  return /^bfg$/i.test(w) ? "BFGoodrich" : w.charAt(0) + w.slice(1).toLowerCase();
}

export const zar = (cents: number) => `${(cents / 100).toFixed(2)} ZAR`;

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function merchantDescription(p: Product): string {
  const d = strip(p.shortDescription || "") || strip(p.description || "");
  const base = d || `${p.name}. Brand new ${merchantBrand(p)} ${p.type === "wheel" ? "mag wheels" : "tyre"} from The Tyre Mall.`;
  return `${base.replace(/[\s.,;:–-]+$/, "")}. Delivered across South Africa. Buy now, pay later with HappyPay.`.slice(0, 4900);
}

/** Why a product can't go to Google (null = fine). */
export function feedProblem(p: Product): string | null {
  if (!(p.price > 0)) return "No price";
  if (!p.image || /placeholder/i.test(p.image)) return "No product photo";
  if (!p.name.trim()) return "No title";
  return null;
}

/** Product structured data (schema.org) for a product page. */
export function productJsonLd(p: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku || undefined,
    productID: merchantId(p),
    image: p.image ? [absUrl(p.image)] : undefined,
    description: merchantDescription(p),
    brand: { "@type": "Brand", name: merchantBrand(p) },
    category: googleCategory(p),
    offers: {
      "@type": "Offer",
      url: `${SITE}/product/${p.slug}`,
      priceCurrency: "ZAR",
      price: (p.price / 100).toFixed(2),
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "The Tyre Mall" },
    },
  };
}
