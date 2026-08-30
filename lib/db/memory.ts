import type {
  DriftBaseline,
  DriftBaselineRepository,
  NewDriftBaseline,
  NewPortfolio,
  Portfolio,
  PortfolioRepository,
  OptimizeUsageRepository,
} from "./types";

/**
 * In-memory implementation, used for local development without a real D1
 * database and for tests. Deliberately implements the exact same interface
 * as the D1-backed repository, so ownership-scoping behaviour is verified
 * once against this fake and trusted to hold for the real implementation
 * (they're both bound by the same contract).
 */
export class MemoryPortfolioRepository implements PortfolioRepository {
  private rows: Portfolio[] = [];
  private nextId = 1;

  async listByUser(userId: string): Promise<Portfolio[]> {
    return this.rows
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getById(userId: string, id: string): Promise<Portfolio | null> {
    const row = this.rows.find((p) => p.id === id && p.userId === userId);
    return row ?? null;
  }

  async create(userId: string, data: NewPortfolio): Promise<Portfolio> {
    const portfolio: Portfolio = {
      ...data,
      id: String(this.nextId++),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(portfolio);
    return portfolio;
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((p) => !(p.id === id && p.userId === userId));
    return this.rows.length < before;
  }

  /** Test/dev helper only — not part of the PortfolioRepository interface. */
  _seed(userId: string, data: NewPortfolio): Promise<Portfolio> {
    return this.create(userId, data);
  }
}

export class MemoryDriftBaselineRepository
  implements DriftBaselineRepository
{
  private rows: DriftBaseline[] = [];

  async getByPortfolioId(
    userId: string,
    portfolioId: string,
  ): Promise<DriftBaseline | null> {
    const row = this.rows.find(
      (baseline) =>
        baseline.portfolioId === portfolioId &&
        baseline.userId === userId,
    );

    return row ?? null;
  }

  async create(
    userId: string,
    data: NewDriftBaseline,
  ): Promise<DriftBaseline> {
    const existing = this.rows.find(
      (baseline) => baseline.portfolioId === data.portfolioId,
    );

    if (existing) {
      throw new Error(
        `Drift baseline already exists for portfolio ${data.portfolioId}.`,
      );
    }

    const baseline: DriftBaseline = {
      ...data,
      userId,
      createdAt: new Date().toISOString(),
    };

    this.rows.push(baseline);

    return baseline;
  }
}

export class MemoryOptimizeUsageRepository implements OptimizeUsageRepository {
  private usage = new Map<string, string>();

  async getLastUsedAt(userId: string): Promise<string | null> {
    return this.usage.get(userId) ?? null;
  }

  async recordUsage(userId: string): Promise<void> {
    this.usage.set(userId, new Date().toISOString());
  }
}

