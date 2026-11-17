import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No dev-only "N" badge: it covers the UI in screenshots and demos.
  devIndicators: false,
  experimental: {
    // The dev filesystem cache (beta, on by default in Next 16) kept serving stale
    // CSS on this Windows setup after files changed. Turning it off only makes the
    // first compile after `npm run dev` a little slower.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
