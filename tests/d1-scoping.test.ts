import { describe, expect, it, vi } from "vitest";
import { D1PortfolioRepository } from "@/lib/db/d1";
import type { NewPortfolio } from "@/lib/db/types";

/** Minimal fake of Cloudflare's D1Database/D1PreparedStatement chain,
 * just enough to assert on what SQL + bindings the repository sends. */
function makeFakeD1(rows: unknown[] = []) {
  const calls: { sql: string; bindings: unknown[] }[] = [];

  const statement = {
    bind: vi.fn((...bindings: unknown[]) => {
      calls.push({ sql: currentSql, bindings });
      return statement;
    }),
    all: vi.fn(async () => ({ results: rows })),
    first: vi.fn(async () => rows[0] ?? null),
    run: vi.fn(async () => ({ meta: { changes: rows.length } })),
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

describe("D1PortfolioRepository query scoping", () => {
  it("listByUser scopes by user_id in the SQL, not just in application code", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    await repo.listByUser("user-A");

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id = ?"));
    expect(calls[0].bindings).toEqual(["user-A"]);
  });

  it("getById filters by both id AND user_id", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    await repo.getById("user-A", "portfolio-1");

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("WHERE id = ? AND user_id = ?"));
    expect(calls[0].bindings).toEqual(["portfolio-1", "user-A"]);
  });

  it("remove filters by both id AND user_id (can't delete someone else's row)", async () => {
    const { db, calls } = makeFakeD1([]);
    const repo = new D1PortfolioRepository(db as never);

    await repo.remove("user-A", "portfolio-1");

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("WHERE id = ? AND user_id = ?"));
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
