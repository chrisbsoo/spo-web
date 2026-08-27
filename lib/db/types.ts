export interface AssetWeight {
  ticker: string;
  weight: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  tickers: string[];
  start: string; // ISO date
  end: string; // ISO date
  algorithm: string;
  gamma: number;
  lambda: number;
  weights: AssetWeight[];
  finalObjective: number;
  sparsityPct: number;
  createdAt: string; // ISO datetime
}

export type NewPortfolio = Omit<Portfolio, "id" | "userId" | "createdAt">;

/**
 * Every method takes userId as its first argument, and every implementation
 * MUST filter by it. This is deliberate: it makes "forgot to scope by owner"
 * (the single most common real-world SaaS data-leak bug) structurally harder
 * to write, because there's no method that returns data without a userId in
 * scope to begin with. See tests/db-ownership.test.ts for the enforcement test.
 */
export interface PortfolioRepository {
  listByUser(userId: string): Promise<Portfolio[]>;
  getById(userId: string, id: string): Promise<Portfolio | null>;
  create(userId: string, data: NewPortfolio): Promise<Portfolio>;
  remove(userId: string, id: string): Promise<boolean>;
}
