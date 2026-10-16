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
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
