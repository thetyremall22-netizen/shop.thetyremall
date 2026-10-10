import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
