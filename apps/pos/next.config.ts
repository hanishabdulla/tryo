import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron loads the dev server through this loopback hostname.
  allowedDevOrigins: ["127.0.0.1"],
  // Electron ships this minimal Node server alongside the desktop shell.
  // `public` and `.next/static` are added by electron-builder (see package.json).
  output: "standalone",
};

export default nextConfig;
