import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained server build for the 0724 (DirectAdmin/Passenger) deploy:
  // `.next/standalone/server.js` + a traced node_modules, so the server needs no
  // `npm install`. Vercel ignores this and deploys as normal.
  output: "standalone",
  // The libSQL client loads a platform-specific native binding at runtime that
  // file tracing can miss — force it into the standalone bundle so the file DB
  // works on the server.
  outputFileTracingIncludes: {
    "**": ["./node_modules/@libsql/**", "./node_modules/libsql/**"],
  },
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
