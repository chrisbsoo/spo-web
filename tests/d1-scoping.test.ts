import { describe, expect, it, vi } from "vitest";
import { D1DriftBaselineRepository, D1PortfolioRepository } from "@/lib/db/d1";

import type { NewDriftBaseline, NewPortfolio } from "@/lib/db/types";

/** Minimal fake of Cloudflare's D1Database/D1PreparedStatement chain,
 * just enough to assert on what SQL + bindings the repository sends. */
function makeFakeD1(rows: unknown[] = [], firstResults?: unknown[]) {
  const calls: { sql: string; bindings: unknown[] }[] = [];
  const queuedFirstResults = firstResults ? [...firstResults] : null;

  const statement = {
    bind: vi.fn((...bindings: unknown[]) => {
      calls.push({ sql: currentSql, bindings });
      return statement;
    }),
    all: vi.fn(async () => ({ results: rows })),
    first: vi.fn(async () => {
      if (queuedFirstResults) {
        return queuedFirstResults.shift() ?? null;
      }

      return rows[0] ?? null;
    }),
    run: vi.fn(async () => ({
      meta: { changes: rows.length },
    })),
  };

  let currentSql = "";

  const db = {
    prepare: vi.fn((sql: string) => {
      currentSql = sql;
      return statement;
    }),
  };

  return { db, calls };
}

const sample: NewPortfolio = {
  name: "Test",
  tickers: ["AAPL"],
  start: "2020-01-01",
  end: "2025-01-01",
  algorithm: "prox-svrg",
  gamma: 2.0,
  lambda: 0.01,
  weights: [{ ticker: "AAPL", weight: 1.0 }],
  finalObjective: 0.01,
  sparsityPct: 0,
};

const sampleBaseline: NewDriftBaseline = {
  portfolioId: "portfolio-1",
  returnsByTicker: {
    AAPL: [0.01, -0.02, 0.015],
    MSFT: [0.005, -0.01, 0.02],
  },
  start: "2020-01-01",
  end: "2025-01-01",
};

describe("D1PortfolioRepository query scoping", () => {
  it("listByUser scopes by user_id in the SQL, not just in application code", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    await repo.listByUser("user-A");

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE user_id = ?"),
    );
    expect(calls[0].bindings).toEqual(["user-A"]);
  });

  it("getById filters by both id AND user_id", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    await repo.getById("user-A", "portfolio-1");

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND user_id = ?"),
    );
    expect(calls[0].bindings).toEqual(["portfolio-1", "user-A"]);
  });

  it("remove filters by both id AND user_id (can't delete someone else's row)", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    await repo.remove("user-A", "portfolio-1");

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND user_id = ?"),
    );
    expect(calls[0].bindings).toEqual(["portfolio-1", "user-A"]);
  });

  it("create binds userId into the inserted row", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    const created = await repo.create("user-A", sample);

    expect(created.userId).toBe("user-A");
    expect(calls[0].bindings).toContain("user-A");
  });
});

describe("D1DriftBaselineRepository query scoping", () => {
  it("getByPortfolioId filters by portfolio_id and user_id", async () => {
    const { db, calls } = makeFakeD1([]);

    const repo = new D1DriftBaselineRepository(db as never);

    await repo.getByPortfolioId("user-A", "portfolio-1");

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE portfolio_id = ? AND user_id = ?"),
    );

    expect(calls[0].bindings).toEqual(["portfolio-1", "user-A"]);
  });

  it("checks that the portfolio belongs to the user before creating a baseline", async () => {
    const { db, calls } = makeFakeD1([], [null]);

    const repo = new D1DriftBaselineRepository(db as never);

    await expect(repo.create("user-A", sampleBaseline)).rejects.toThrow(
      "Portfolio portfolio-1 not found.",
    );

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND user_id = ?"),
    );

    expect(calls[0].bindings).toEqual(["portfolio-1", "user-A"]);
  });

  it("inserts the baseline with the correct user and return data", async () => {
    const { db, calls } = makeFakeD1([], [{ id: "portfolio-1" }, null]);

    const repo = new D1DriftBaselineRepository(db as never);

    const created = await repo.create("user-A", sampleBaseline);

    expect(created.userId).toBe("user-A");
    expect(created.returnsByTicker).toEqual(sampleBaseline.returnsByTicker);

    expect(calls[2].bindings).toEqual([
      "portfolio-1",
      "user-A",
      JSON.stringify(sampleBaseline.returnsByTicker),
      "2020-01-01",
      "2025-01-01",
      created.createdAt,
    ]);
  });

  it("rejects creation when a baseline already exists", async () => {
    const existingBaselineRow = {
      portfolio_id: "portfolio-1",
      user_id: "user-A",
      returns_by_ticker: JSON.stringify(sampleBaseline.returnsByTicker),
      start_date: "2020-01-01",
      end_date: "2025-01-01",
      created_at: "2026-08-29T12:00:00.000Z",
    };

    const { db, calls } = makeFakeD1(
      [],
      [{ id: "portfolio-1" }, existingBaselineRow],
    );

    const repo = new D1DriftBaselineRepository(db as never);

    await expect(repo.create("user-A", sampleBaseline)).rejects.toThrow(
      "Drift baseline already exists for portfolio portfolio-1.",
    );

    expect(calls).toHaveLength(2);
  });
});
