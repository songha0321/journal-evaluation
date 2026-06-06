import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes the Cloudflare bindings (env.DB) available under `next dev`.
// Skipped in mock mode (USE_MOCK_DB=1), which runs as plain Next without the
// Workers runtime — useful for UI work where the local D1/workerd isn't available.
if (process.env.USE_MOCK_DB !== "1") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {};

export default nextConfig;
