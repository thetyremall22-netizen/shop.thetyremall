import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Build-time static generation only. Each prerender worker independently
  // parses the 11 MB catalogue + 4 MB vehicle data, so the default ~10 workers
  // thrash memory on a dev machine and pages falsely "time out". Cap the worker
  // count (high min-pages-per-worker → few workers) and the per-worker
  // concurrency so the build is slower but reliable. This has NO effect on the
  // running server — product pages are prerendered (seed) or generated
  // on-demand at request time and then cached; the server is one shared process.
  experimental: {
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 2000,
  },
  // The site now runs as plain Node behind nginx (no Nginx Unit), so Next
  // gzips its own responses — including the CSS/JS files, which nginx on h1
  // doesn't compress (its gzip_types only covers HTML). Live server.js was
  // switched to match with ~/ttm-compress-on.sh (undo: ~/ttm-compress-off.sh).
  compress: true,
  // Self-contained server build for the 0724 (DirectAdmin/Passenger) deploy:
  // `.next/standalone/server.js` + a traced node_modules, so the server needs no
  // `npm install`. Vercel ignores this and deploys as normal.
  output: "standalone",
  // The libSQL client loads a platform-specific native binding at runtime that
  // file tracing can miss — force it into the standalone bundle so the file DB
  // works on the server.
  // The SQLite driver loads a platform-specific native binding at runtime that
  // file tracing can miss — force better-sqlite3 and its loader deps into the
  // standalone bundle so the file DB works on the server.
  outputFileTracingIncludes: {
    "**": [
      "./node_modules/better-sqlite3/**",
      "./node_modules/bindings/**",
      "./node_modules/file-uri-to-path/**",
    ],
  },
  // Old WooCommerce category links (e.g. /product-category/mag-wheel/ in
  // Google Ads) end in "/". Serve them directly instead of 308-redirecting to
  // the no-slash URL. This only changes the build's routes-manifest (inside
  // .next); every page sets a canonical URL, so search engines see one address.
  skipTrailingSlashRedirect: true,
  images: {
    // Product images are pre-sized local webp — serve them directly instead of
    // through Vercel's image optimizer so we don't hit the Hobby transform cap.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "thetyremall.co.za", pathname: "/wp-content/**" },
      { protocol: "https", hostname: "**.thetyremall.co.za", pathname: "/wp-content/**" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
