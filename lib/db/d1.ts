import type { D1Database } from "@cloudflare/workers-types";
import type {
  AssetWeight,
  DriftBaseline,
  DriftBaselineRepository,
  NewDriftBaseline,
  NewPortfolio,
  Portfolio,
  PortfolioRepository,
} from "./types";

interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  tickers: string; // JSON-encoded string[]
  start_date: string;
  end_date: string;
  algorithm: string;
  gamma: number;
  lambda: number;
  weights: string; // JSON-encoded AssetWeight[]
  final_objective: number;
  sparsity_pct: number;
  created_at: string;
}

interface DriftBaselineRow {
  portfolio_id: string;
  user_id: string;
  returns_by_ticker: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

function rowToDriftBaseline(row: DriftBaselineRow): DriftBaseline {
  return {
    portfolioId: row.portfolio_id,
    userId: row.user_id,
    returnsByTicker: JSON.parse(row.returns_by_ticker) as Record<
      string,
      number[]
    >,
    start: row.start_date,
    end: row.end_date,
    createdAt: row.created_at,
  };
}

function rowToPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tickers: JSON.parse(row.tickers) as string[],
    start: row.start_date,
    end: row.end_date,
    algorithm: row.algorithm,
    gamma: row.gamma,
    lambda: row.lambda,
    weights: JSON.parse(row.weights) as AssetWeight[],
    finalObjective: row.final_objective,
    sparsityPct: row.sparsity_pct,
    createdAt: row.created_at,
  };
}

/**
 * Real production repository, backed by Cloudflare D1. Every query below is
 * a parameterized prepared statement (never string-interpolated SQL — that
 * would be a straight SQL-injection bug) and every SELECT/DELETE includes
 * `WHERE user_id = ?` even where a caller might assume the id alone is
 * enough (see getById/remove) — that redundancy is intentional, not
 * sloppiness: it's what makes cross-user data leaks structurally impossible
 * rather than just "unlikely if everyone remembers."
 */
export class D1PortfolioRepository implements PortfolioRepository {
  constructor(private readonly db: D1Database) {}

  async listByUser(userId: string): Promise<Portfolio[]> {
    const { results } = await this.db
      .prepare(
        "SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC",
      )
      .bind(userId)
      .all<PortfolioRow>();
    return results.map(rowToPortfolio);
  }

  async getById(userId: string, id: string): Promise<Portfolio | null> {
    const row = await this.db
      .prepare("SELECT * FROM portfolios WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .first<PortfolioRow>();
    return row ? rowToPortfolio(row) : null;
  }

  async create(userId: string, data: NewPortfolio): Promise<Portfolio> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO portfolios
          (id, user_id, name, tickers, start_date, end_date, algorithm, gamma, lambda, weights, final_objective, sparsity_pct, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        userId,
        data.name,
        JSON.stringify(data.tickers),
        data.start,
        data.end,
        data.algorithm,
        data.gamma,
        data.lambda,
        JSON.stringify(data.weights),
        data.finalObjective,
        data.sparsityPct,
        createdAt,
      )
      .run();

    return { ...data, id, userId, createdAt };
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM portfolios WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }
}

export class D1DriftBaselineRepository implements DriftBaselineRepository {
  constructor(private readonly db: D1Database) {}

  async getByPortfolioId(
    userId: string,
    portfolioId: string,
  ): Promise<DriftBaseline | null> {
    const row = await this.db
      .prepare(
        `SELECT *
         FROM drift_baselines
         WHERE portfolio_id = ? AND user_id = ?`,
      )
      .bind(portfolioId, userId)
      .first<DriftBaselineRow>();

    return row ? rowToDriftBaseline(row) : null;
  }

  async create(userId: string, data: NewDriftBaseline): Promise<DriftBaseline> {
    const portfolio = await this.db
      .prepare(
        `SELECT id
     FROM portfolios
     WHERE id = ? AND user_id = ?`,
      )
      .bind(data.portfolioId, userId)
      .first<{ id: string }>();

    if (!portfolio) {
      throw new Error(`Portfolio ${data.portfolioId} not found.`);
    }
    const existing = await this.getByPortfolioId(userId, data.portfolioId);

    if (existing) {
      throw new Error(
        `Drift baseline already exists for portfolio ${data.portfolioId}.`,
      );
    }

    const createdAt = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO drift_baselines
          (
            portfolio_id,
            user_id,
            returns_by_ticker,
            start_date,
            end_date,
            created_at
          )
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        data.portfolioId,
        userId,
        JSON.stringify(data.returnsByTicker),
        data.start,
        data.end,
        createdAt,
      )
      .run();

    return {
      ...data,
      userId,
      createdAt,
    };
  }
}
