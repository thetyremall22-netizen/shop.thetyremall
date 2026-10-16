// Google tracking IDs for The Tyre Mall.
// These are PUBLIC identifiers (they ship in every page's HTML on any site that
// uses them), so it's fine to keep them in source. They mirror the Google Site
// Kit setup on the current live WordPress site so Analytics, Ads conversions and
// Tag Manager keep working after the cut-over to the new site.
//
// To disable all tracking (e.g. on a staging/preview build) set
// NEXT_PUBLIC_DISABLE_ANALYTICS=1 in the environment.

export const GTM_ID = "GTM-TFDH3XL8";

// gtag.js config targets loaded through the primary Google tag (GT-PZZPCG3).
export const GTAG_IDS = [
  "GT-PZZPCG3", // primary Google tag (Site Kit)
  "GT-PL3TPMJF", // secondary Google tag
  "G-46KVRMNWK5", // GA4 measurement ID
  "AW-858886436", // Google Ads
] as const;

// The tag that actually loads gtag.js (first in the list).
export const PRIMARY_GTAG_ID = GTAG_IDS[0];

// Google Search Console domain verification.
export const SEARCH_CONSOLE_VERIFICATION =
  "dtCCnIVRbwt0bqYEe2SnuEU1uasou_vtFu484p0Afjs";

// Site Kit developer id (identifies traffic as coming via Site Kit historically).
export const DEVELOPER_ID = "dOGY3NW";

// EU / EEA / UK + EFTA regions where Consent Mode v2 defaults to "denied" until
// the visitor makes a choice. Everywhere else (incl. South Africa) defaults to
// granted, but the cookie banner still lets anyone opt out. Matches the live site.
export const CONSENT_DENIED_REGIONS = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR",
  "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MT",
  "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK",
];

export const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_DISABLE_ANALYTICS !== "1";
