-- spo-web D1 schema
-- Apply with: wrangler d1 execute spo-web-db --file=./schema.sql (add --remote for production)

CREATE TABLE IF NOT EXISTS portfolios (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  tickers         TEXT NOT NULL,   -- JSON-encoded string[]
  start_date      TEXT NOT NULL,   -- ISO date
  end_date        TEXT NOT NULL,   -- ISO date
  algorithm       TEXT NOT NULL,
  gamma           REAL NOT NULL,
  lambda          REAL NOT NULL,
  weights         TEXT NOT NULL,   -- JSON-encoded {ticker, weight}[]
  final_objective REAL NOT NULL,
  sparsity_pct    REAL NOT NULL,
  created_at      TEXT NOT NULL    -- ISO datetime
);

-- Every read/write in D1PortfolioRepository filters by user_id; this index
-- is what keeps "list my portfolios" fast as the table grows, rather than a
-- full-table scan per request.
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
