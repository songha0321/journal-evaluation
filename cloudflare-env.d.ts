// Cloudflare bindings available to the Worker runtime.
// `npm run cf-typegen` regenerates this from wrangler.toml; kept in-repo so types
// resolve before the first generation.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
}
