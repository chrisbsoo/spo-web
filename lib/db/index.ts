import { D1PortfolioRepository } from "./d1";
import { MemoryPortfolioRepository } from "./memory";
import type { PortfolioRepository } from "./types";

// A single in-memory store shared across requests during local `next dev`
// (no real D1 binding available outside the Cloudflare runtime / `wrangler
// dev`). Data doesn't survive a server restart — that's expected for local
// development, not a bug.
let devStore: MemoryPortfolioRepository | null = null;

/**
 * Returns the right PortfolioRepository for the current environment.
 * In production (Cloudflare Workers), `getCloudflareContext().env.DB` is the
 * real D1 binding declared in wrangler.jsonc. Locally, falls back to an
 * in-memory store so `next dev` works without any Cloudflare setup.
 */
export async function getPortfolioRepository(): Promise<PortfolioRepository> {
  try {
    // Dynamically imported so this module doesn't hard-fail outside the
    // Cloudflare runtime (e.g. in Vitest, which runs plain Node).
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = getCloudflareContext();
    if (context.env.DB) {
      return new D1PortfolioRepository(context.env.DB);
    }
  } catch {
    // Not running under the Cloudflare adapter (local `next dev`, tests, CI build) — fall through.
  }

  if (!devStore) devStore = new MemoryPortfolioRepository();
  return devStore;
}
