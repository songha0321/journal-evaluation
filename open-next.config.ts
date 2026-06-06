import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults are sufficient for the first pass (no ISR/queue/cache customization yet).
export default defineCloudflareConfig();
