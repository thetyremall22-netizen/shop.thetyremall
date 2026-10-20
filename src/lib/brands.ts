// Brand line-up for the mega menu and home brand wall — derived from the live
// catalogue so every brand we actually stock is shown (and no dead brands).
import metaData from "@/data/meta.json";

export const brandSlug = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Not tyre brands: A-Line is mag wheels, "Tyre Mall" is our own house label.
const EXCLUDE = new Set(["a-line", "tyre-mall"]);

export const BRANDS: string[] = (metaData.brands as { name: string; count: number }[])
  .filter((b) => b.count > 0 && !EXCLUDE.has(brandSlug(b.name)))
  .map((b) => b.name);

// Brands we have a real logo image file for (public/brand/logos/<slug>.*).
const LOGO_SLUGS = new Set([
  "bridgestone", "pirelli", "goodyear", "dunlop", "continental", "michelin",
  "radar", "yokohama", "bfgoodrich", "firestone", "general", "sumitomo",
  "falken", "landsail", "windforce", "tracmax", "kapsen", "firemax",
  "annaite", "landspider", "anchee", "timax", "sava", "roadking",
]);

export const hasBrandLogo = (b: string) => LOGO_SLUGS.has(brandSlug(b));
export const brandLogoPath = (b: string) =>
  brandSlug(b) === "radar" ? "/brand/logos/radar.png" : `/brand/logos/${brandSlug(b)}.webp`;
// Brand pages: /product-category/<brand-slug> (served directly, no redirect).
export const brandHref = (b: string) => `/product-category/${brandSlug(b)}`;
