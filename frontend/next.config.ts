import type { NextConfig } from "next";
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Force-load env files as the very first thing this module does. ES imports
// are hoisted, so the explicit `loadDotenv` calls below run before any of
// Next.js's internal setup that might cache `process.env` for client-bundle
// inlining. We use `dotenv` directly (not @next/env) because @next/env keeps
// an internal snapshot (`initialEnv`) that gets captured before our config
// file runs in some launch paths (notably `convex dev --start 'next dev'`).
const projectDir = process.cwd();
const envPath = join(projectDir, ".env");
if (existsSync(envPath)) {
  loadDotenv({ path: envPath, override: false, quiet: true });
}

if (process.env.NODE_ENV !== "production") {
  console.info("[next.config] env loaded:", {
    cwd: projectDir,
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    kickOffBet: process.env.NEXT_PUBLIC_KICKOFF_BET,
    kickOffMatchBet: process.env.NEXT_PUBLIC_KICKOFF_MATCH_BET,
  });
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // RFC1918 LAN ranges + localhost for `next dev` HMR over Wi-Fi.
  allowedDevOrigins: [
    "*.e2b.app",
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
    "172.21.*.*",
    "172.22.*.*",
    "172.23.*.*",
    "172.24.*.*",
    "172.25.*.*",
    "172.26.*.*",
    "172.27.*.*",
    "172.28.*.*",
    "172.29.*.*",
    "172.30.*.*",
    "172.31.*.*",
  ],
};

export default nextConfig;
