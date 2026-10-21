// Countries that can be fully blocked (Admin → Settings → Visitors outside
// South Africa). Address data for these ships in src/data/geo-block.json —
// keep this list in sync with BLOCKABLE in scripts/update-geo.mjs.
export const BLOCKABLE_COUNTRIES: { code: string; name: string }[] = [
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "JP", name: "Japan" },
  { code: "TH", name: "Thailand" },
  { code: "RU", name: "Russia" },
  { code: "NG", name: "Nigeria" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "VN", name: "Vietnam" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "KP", name: "North Korea" },
  { code: "BY", name: "Belarus" },
  { code: "UA", name: "Ukraine" },
  { code: "KH", name: "Cambodia" },
  { code: "MM", name: "Myanmar" },
];

/** Fully blocked unless changed in Settings. */
export const DEFAULT_BLOCKED = ["CN", "HK", "JP", "TH", "RU", "NG", "ZW"];
