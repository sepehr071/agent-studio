import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native addon — must stay external to the Turbopack server bundle
  serverExternalPackages: ["better-sqlite3"],
  // Keep the floating dev badge out of the (RTL) chat composer corner
  devIndicators: false,
};

export default nextConfig;
