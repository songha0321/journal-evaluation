/// <reference types="@cloudflare/workers-types" />
// Cloudflare bindings available to the Worker runtime.
// `npm run cf-typegen` regenerates this from wrangler.toml; kept in-repo so types
// resolve before the first generation.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  // AI (선택) — Worker secret으로 주입. 없으면 규칙 기반 폴백.
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
}
