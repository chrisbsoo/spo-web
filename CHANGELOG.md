# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

## [0.2.0] - 2026-08-31

### Added
- Data drift detection (contributed by Keyaan Miah): PSI + Kolmogorov-Smirnov
  statistics comparing live market returns against each saved portfolio's
  frozen optimisation baseline, with a per-ticker breakdown and overall
  stable/warning/drift status on the portfolio detail page.
- `drift_baselines` and `optimize_usage` D1 tables.
- Per-account rate limiting: one `/optimize` call per hour per user, with a
  friendly error message instead of a raw API failure.

### Changed
- Market data fetching moved from direct, unauthenticated calls to Yahoo
  Finance into a call to `spo-tools`'s new `/returns` endpoint — fixes
  intermittent HTTP 429s from Yahoo that were blocking portfolio saves in
  production. One source of truth for market data across both services.

### Fixed
- Missing `optimize_usage` table on the live database (schema changes in
  the repo don't auto-apply to D1 — `wrangler d1 execute --remote` is a
  separate, manual step from deploying code).


## [0.1.0] - 2026-08-27

### Added
- Terminal-amber design system; logo + "SPO Web" wordmark in the header.
- Adaptive bar-chart hover: exact percentage shown inside the bar when
  there's room, outside it when the bar's too small to fit the label.
- Core loop: Clerk auth, portfolio-building form (tickers, date range,
  algorithm, risk/sparsity sliders), calling `spo-tools`'s `/optimize`.
- Save/list/delete portfolios via Cloudflare D1, with ownership scoping
  enforced at the repository interface level.
- Deployed to Cloudflare Workers via the OpenNext adapter; CI/CD via
  GitHub Actions (lint, typecheck, test, build, deploy).