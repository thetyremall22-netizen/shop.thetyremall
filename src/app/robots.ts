import type { MetadataRoute } from "next";

const BASE = "https://thetyremall.co.za";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep crawlers out of transactional + private areas. These are the
        // new site's real paths — not the old WordPress/WooCommerce ones.
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/cart",
          "/checkout",
          "/compare",
          "/maintenance",
          "/coming-soon",
          // Stop crawlers exploring the /shop filter combinations (width, profile,
          // rim, brand, sort, page, sizes…) — a near-infinite faceted-navigation
          // crawl trap that hammers the server. Clean URLs (/shop, /product/*,
          // categories) are still crawled and indexed.
          "/*?",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
