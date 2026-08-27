# spo-web

The trader-facing product: log in, build a sparse portfolio allocation from
real tickers, save it, come back to it later. Frontend + gateway in one
Next.js app; the actual optimization math lives in a separate, already-live
service, [`spo-tools`](https://github.com/<your-username>/spo-tools).

```
Browser --> Next.js (Cloudflare Pages/Workers) --> spo-tools API (Render)
                |
                v
        D1 (accounts, saved portfolios) via Clerk-authenticated routes
```

## Status

v0.1 (core loop): auth, build a portfolio, save it, view it, delete it. All
build/test/typecheck-verified locally (see below). Not yet deployed to a
real Cloudflare account — that's the next step, and needs your credentials,
not mine.

Drift detection (reusing the PSI/KS logic from `modelwatch`) is planned for
v0.3, deliberately last — see the parent roadmap discussion.

## What's actually verified vs. what still needs you

I can't create Cloudflare/Clerk accounts or provision real infrastructure —
so everything below was checked as far as it can be without your real
credentials:

| Checked | How |
|---|---|
| Every API route compiles and type-checks | `npm run typecheck` — clean |
| Ownership scoping (user A can't read/delete/list user B's data) | `npm test` — 18/18, including 3 tests specifically for this |
| Input validation (bad tickers, bad dates, out-of-range params all rejected) | `npm test` |
| The whole app actually builds, every route included | `npm run build` — succeeds, all 9 routes compile |
| D1 queries are parameterized and user-scoped, not just "should be" | `npm test` — asserts on the actual SQL + bindings sent |

**Not yet checked** (needs a real Cloudflare account + Clerk keys, which I don't have):
- Deploying to Cloudflare Workers via `opennextjs-cloudflare`
- Creating and migrating a real D1 database
- Clerk auth actually completing a real sign-in flow in a browser

## Setup

```bash
git clone https://github.com/<your-username>/spo-web.git
cd spo-web
npm install
cp .env.example .env.local
npm run dev
```

Local dev uses an in-memory portfolio store (no D1 needed) — data resets
every time the dev server restarts. That's expected, not a bug; D1 only
kicks in once deployed (or under `wrangler dev`).

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run test` | Vitest — 18 tests, ownership scoping + validation |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Real `next build` — verifies every route compiles |
| `npm run cf:deploy` | Builds via OpenNext and deploys to Cloudflare Workers |

## Deploying — what you need to do

1. **Create a Clerk app** at clerk.com (free tier, 50K MAU). Copy the
   publishable + secret keys.
2. **Create the D1 database**:
   ```bash
   npx wrangler login
   npx wrangler d1 create spo-web-db
   ```
   Copy the `database_id` it prints into `wrangler.jsonc` (there's a
   placeholder marking exactly where).
3. **Apply the schema**:
   ```bash
   npx wrangler d1 execute spo-web-db --remote --file=./schema.sql
   ```
4. **Set secrets** for the deployed Worker (not just local `.env.local`):
   ```bash
   npx wrangler secret put CLERK_SECRET_KEY
   ```
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `SPO_TOOLS_URL` are public-safe —
   set them as plain vars in the Cloudflare dashboard (Workers & Pages ->
   your project -> Settings -> Variables) rather than secrets.
5. **Deploy**:
   ```bash
   npm run cf:deploy
   ```
   First run prints your live `*.workers.dev` URL. A custom domain can be
   attached afterward in the Cloudflare dashboard.
6. **Connect CI to auto-build** (optional but recommended, matches the other
   two repos' pattern): Cloudflare's Git integration (Workers & Pages ->
   Create -> connect this repo) rebuilds and redeploys on every push to
   `main`, reading `wrangler.jsonc` the same way Render reads `render.yaml`.

## Why a Next.js app instead of a separate frontend + Workers gateway

Next.js API routes deployed via `@opennextjs/cloudflare` already run *as*
Cloudflare Workers under the hood — a separate Workers project for "the
gateway" would just be the same runtime with extra deployment overhead.
UI lives in `app/`, gateway logic (auth check, D1 access, proxying to
`spo-tools`) lives in `app/api/*` — architecturally distinct, operationally
one deploy.

`@opennextjs/cloudflare` was chosen over Cloudflare's newer `vinext`
recommendation deliberately: `vinext` is days old as of this writing;
OpenNext hit 1.0 GA in February 2026 and has broad community
troubleshooting behind it. Worth revisiting once `vinext` has more track
record, not worth the risk for a project that needs to actually work now.

## Repository layout

```
app/
  page.tsx                 landing page
  layout.tsx                 ClerkProvider + global styles
  sign-in/, sign-up/           Clerk auth pages
  dashboard/
    page.tsx                    list saved portfolios
    new/page.tsx                  build + save a new one (the core loop)
    [id]/page.tsx                  view a saved portfolio
  api/
    optimize/route.ts           proxies to spo-tools, no persistence
    portfolios/route.ts           list/save, scoped to the logged-in user
    portfolios/[id]/route.ts        get/delete one, ownership-checked
lib/
  db/
    types.ts                  PortfolioRepository interface (ownership scoping baked into every method signature)
    memory.ts                   in-memory implementation (local dev, tests)
    d1.ts                        real D1 implementation (production)
    index.ts                      picks the right one for the environment
  validation.ts               zod schemas
  spo-tools-client.ts           the only place this app talks to spo-tools
proxy.ts                      Clerk auth gate (Next.js 16's "proxy" convention, formerly "middleware")
schema.sql                    D1 schema
wrangler.jsonc                 Cloudflare deploy config
tests/                        18 tests: ownership scoping, D1 query scoping, validation
```

## On the ownership-scoping pattern

The single most common real SaaS bug is a route that fetches by ID without
checking the caller owns that ID — someone changes a URL and reads someone
else's data. `PortfolioRepository`'s interface makes every method require
`userId` as its first argument, so there's no code path that returns data
without an owner in scope to begin with. `tests/db-ownership.test.ts` and
`tests/d1-scoping.test.ts` test this directly, including that the D1
implementation's actual SQL contains `WHERE user_id = ?`, not just that the
application code intends it to.

## License

MIT.
