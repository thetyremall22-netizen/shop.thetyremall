// Full brand line-up shown in the mega menu and home brand wall.
// A logo image is used where we have one; otherwise a clean wordmark tile.
export const BRANDS: string[] = [
  "Bridgestone", "Pirelli", "Goodyear", "Dunlop", "Continental", "Michelin",
  "Radar", "Hankook", "Yokohama", "BFGoodrich", "Firestone", "General",
  "Sumitomo", "Falken", "Landsail", "Windforce", "Tracmax", "Kapsen",
  "Maxxis", "Kumho", "Apollo", "CEAT", "Firemax", "Annaite", "Landspider",
  "Xcent", "Anchee", "Timax", "Sava", "Roadking", "Drivemaster", "American Road Star",
];

// Brands we have a real logo image file for (public/brand/logos/<slug>.*).
const LOGO_SLUGS = new Set([
  "bridgestone", "pirelli", "goodyear", "dunlop", "continental", "michelin",
  "radar", "yokohama", "bfgoodrich", "firestone", "general", "sumitomo",
  "falken", "landsail", "windforce", "tracmax", "kapsen", "firemax",
  "annaite", "landspider", "anchee", "timax", "sava", "roadking",
]);

export const brandSlug = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
export const hasBrandLogo = (b: string) => LOGO_SLUGS.has(brandSlug(b));
export const brandLogoPath = (b: string) =>
  brandSlug(b) === "radar" ? "/brand/logos/radar.png" : `/brand/logos/${brandSlug(b)}.webp`;
export const brandHref = (b: string) => `/shop?brand=${encodeURIComponent(b)}`;
