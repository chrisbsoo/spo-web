# spo-web

**Live: [spo-web.com](https://spo-web.com)**

The trader-facing product: log in, build a sparse portfolio allocation from
real tickers, save it, come back to it later, and get notified if the market
has drifted away from what you optimised against. Frontend + gateway in one
Next.js app; the optimization math and market data both live in a separate,
independently deployed service, [`spo-tools`](https://github.com/chrisbsoo/spo-tools).


## Status

**v0.2.0, live.** Auth, build/save/view/delete a portfolio, and data drift
detection (PSI + Kolmogorov-Smirnov statistics comparing live market returns
against each saved portfolio's frozen baseline) are all shipped and running
in production. Full history in [CHANGELOG.md](CHANGELOG.md).

## 🤖 Ask an LLM about this repo

Paste the block below into ChatGPT, Claude, Gemini, or whatever your favourite LLM is. 

This is a compact primer covering what this project does, how it's
built, and where everything lives, so you can ask follow-up questions
without reading the whole repo first.

```
You are helping someone understand a GitHub repository called spo-web.

WHAT IT IS: A live web app for traders — log in, enter stock tickers and a
date range, get a sparse portfolio allocation back (most positions driven
to exactly zero, not just small — an L1-regularised optimisation result,
not a heuristic), save it, and get notified if live market data has since
drifted from what the portfolio was optimised against.

LIVE URL: https://spo-web.com

ARCHITECTURE — two independently deployed services, not one monolith:
- spo-web (this repo): Next.js on Cloudflare Workers (via the OpenNext
  adapter), Clerk for auth, Cloudflare D1 for storage. Handles the UI,
  user accounts, saved portfolios, and drift detection.
- spo-tools (github.com/chrisbsoo/spo-tools): a separate Python/FastAPI
  service on Render. Does the actual numerical work — four variance-
  reduced stochastic gradient optimisers (SPGD, Prox-SVRG, Prox-SARAH,
  Prox-STORM), each with a proven convergence guarantee from an
  undergraduate dissertation — plus a /returns endpoint that fetches and
  caches market data, used by both services so there's one source of
  truth rather than two implementations hitting Yahoo Finance separately.

KEY DESIGN DECISION WORTH KNOWING: every database read/write in spo-web
requires a userId as the first argument at the type level (see
lib/db/types.ts) — there is no code path that can return data without an
owner in scope. This exists specifically to make "forgot to scope a query
by user" (the most common real SaaS data-leak bug) structurally hard to
write, not just discouraged by convention. It's tested directly, including
assertions on the literal SQL sent to the database, not just app-level
behaviour.

STACK: TypeScript, Next.js (App Router), Cloudflare Workers, D1 (SQLite at
the edge), Clerk, Vitest — on this side. Python, FastAPI, NumPy, Prometheus,
pytest, Render — on spo-tools.

TESTED AND DEPLOYED, NOT JUST WRITTEN: both services have CI/CD (GitHub
Actions) gating every deploy on lint/typecheck/test passing first. Combined
~95+ tests across both repos. Full version history in CHANGELOG.md.

REPO LAYOUT: app/ (pages + API routes), lib/db/ (repository pattern —
memory implementation for local dev/tests, D1 for production), lib/drift/
(the PSI/Kolmogorov-Smirnov statistical drift detection), schema.sql (D1
schema), wrangler.jsonc (deploy config).

You can help by: explaining any file in the repo, walking through how a
request flows from the browser to the database, explaining the drift-
detection math, or suggesting what to look at first based on what the
person wants to understand.
```

## What's in production?

| Verified | How |
|---|---|
| Real signup → build → save → refresh → data persists | Done manually against the live site, not just mocked tests |
| Drift detection against real market data | Screenshot-verified two days running, numbers shift correctly as new trading days land |
| Ownership scoping (user A can't read/delete/list user B's data) | Tests assert on the actual SQL sent, not just app-level behaviour |
| Market data fetching | Migrated from direct Yahoo Finance calls to `spo-tools`'s `/returns` endpoint after production 429s, see [CHANGELOG](CHANGELOG.md) |
| Per-account rate limiting | One `/optimize` call/hour/user, enforced via D1, friendly error message on limit |

## The core loop

1. Log in (Clerk)
2. Enter tickers, a date range, pick an algorithm, set risk-aversion/sparsity via sliders
3. Run it, calls `spo-tools`'s `/optimize`, shows the allocation as a chart (hover a bar for the exact percentage)
4. Save it, persists to D1, and freezes a snapshot of that period's return distribution as a drift baseline
5. Come back later, hit "Check drift", compares fresh market data against that baseline, flags `stable`/`warning`/`drift` per ticker

## Setup

```bash
git clone https://github.com/chrisbsoo/spo-web.git
cd spo-web
npm install
cp .env.example .env.local   # real Clerk keys + SPO_TOOLS_URL
npm run dev
```

Local dev uses an in-memory store for portfolios/drift baselines/usage, no
D1 needed, resets on restart. Expected, not a bug; D1 only applies once
deployed (or under `wrangler dev`).

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run test` | Vitest, ownership scoping, D1 query scoping, validation, drift statistics, market-data client |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Real `next build`, verifies every route compiles |
| `npm run cf:deploy` | Builds via OpenNext and deploys to Cloudflare Workers |

## Deploying your own copy

1. **Clerk app** at clerk.com (free tier, 50K MAU), publishable + secret keys.
2. **D1 database**: `npx wrangler login && npx wrangler d1 create spo-web-db`, paste the printed `database_id` into `wrangler.jsonc`.
3. **Apply the schema, this is a separate manual step from deploying code, easy to miss:**
```bash
   npx wrangler d1 execute spo-web-db --remote --file=./schema.sql
```
   `CREATE TABLE IF NOT EXISTS` throughout, so safe to re-run any time you add a table and aren't sure it's migrated.
4. **Secrets**: `npx wrangler secret put CLERK_SECRET_KEY`. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `SPO_TOOLS_URL` are public-safe, set as plain `vars` in `wrangler.jsonc` or the Cloudflare dashboard.
5. **Deploy**: `npm run cf:deploy`, prints your live `*.workers.dev` URL; attach a custom domain afterward via the Domains tab.
6. **CI/CD**: GitHub Actions builds and deploys on every push to `main` (see `.github/workflows/cd.yml`), tests gate the deploy, so a broken build never ships.

## Why a Next.js app?

Next.js API routes deployed via `@opennextjs/cloudflare` already run *as*
Cloudflare Workers under the hood, a separate Workers project for "the
gateway" would just be the same runtime with extra deployment overhead. UI
in `app/`, gateway logic (auth, D1, proxying to `spo-tools`) in `app/api/*`, architecturally distinct, operationally one deploy.

## Repository layout (backend)

app/
├── page.tsx, layout.tsx        landing page, ClerkProvider + global styles
├── sign-in/, sign-up/          Clerk auth pages
├── dashboard/
│   ├── page.tsx                list saved portfolios
│   ├── new/page.tsx            build + save a new one
│   └── [id]/page.tsx, DriftCheck.tsx  view a portfolio + run a drift check
└── api/
    ├── optimize/route.ts       proxies to spo-tools, rate-limited per account
    ├── portfolios/route.ts     list/save, scoped to the logged-in user
    ├── portfolios/[id]/route.ts        get/delete one, ownership-checked
    └── portfolios/[id]/drift/route.ts  compares live data against the saved baseline

lib/
├── db/                         PortfolioRepository, DriftBaselineRepository, OptimizeUsageRepository
│                                 — memory (dev/test) + D1 (production) implementations of each
├── drift/                      statistics.ts (PSI, KS test), market-data.ts (calls spo-tools/returns), service.ts
├── validation.ts
└── spo-tools-client.ts

proxy.ts          Clerk auth gate
schema.sql         D1 schema: portfolios, drift_baselines, optimize_usage
wrangler.jsonc      Cloudflare deploy config
tests/              ownership scoping, D1 query scoping, validation, drift math, market-data client


## Ownership Scoping Pattern

The single most common real SaaS bug is a route that fetches by ID without
checking the caller owns that ID. Every repository interface (`Portfolio`,
`DriftBaseline`, `OptimizeUsage`) requires `userId` as its first argument on
every method, so there's no code path that returns data without an owner in
scope to begin with, enforced by tests asserting on the actual SQL sent,
not just application-level behaviour.

## Version history

Full changelog: [CHANGELOG.md](CHANGELOG.md). Latest: **v0.2.0**, data
drift detection, market-data fetching migrated to `spo-tools` (fixed
production Yahoo rate-limit failures), per-account rate limiting.

## Contributors

Data drift detection (`lib/drift/`, the drift API route, and the
`DriftCheck` UI) by [Keyaan Miah](https://github.com/KM016).

## License

MIT.
