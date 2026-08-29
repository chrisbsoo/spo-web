import { describe, expect, it } from "vitest";
import {
  MemoryDriftBaselineRepository,
  MemoryPortfolioRepository,
} from "@/lib/db/memory";

import type { NewDriftBaseline, NewPortfolio } from "@/lib/db/types";
const samplePortfolio: NewPortfolio = {
  name: "Tech tilt",
  tickers: ["AAPL", "MSFT", "NVDA"],
  start: "2020-01-01",
  end: "2025-01-01",
  algorithm: "prox-svrg",
  gamma: 2.0,
  lambda: 0.01,
  weights: [
    { ticker: "AAPL", weight: 0.4 },
    { ticker: "MSFT", weight: 0.3 },
    { ticker: "NVDA", weight: 0.3 },
  ],
  finalObjective: 0.0081,
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

describe("PortfolioRepository ownership scoping", () => {
  it("does not let user B read user A's portfolio by id", async () => {
    const repo = new MemoryPortfolioRepository();
    const created = await repo._seed("user-A", samplePortfolio);

    const asOwner = await repo.getById("user-A", created.id);
    const asOther = await repo.getById("user-B", created.id);

    expect(asOwner).not.toBeNull();
    expect(asOther).toBeNull();
  });

  it("does not let user B delete user A's portfolio", async () => {
    const repo = new MemoryPortfolioRepository();
    const created = await repo._seed("user-A", samplePortfolio);

    const deletedByOther = await repo.remove("user-B", created.id);
    expect(deletedByOther).toBe(false);

    // Still there — user B's failed delete attempt must not have removed it.
    const stillThere = await repo.getById("user-A", created.id);
    expect(stillThere).not.toBeNull();
  });

  it("does not include other users' portfolios in listByUser", async () => {
    const repo = new MemoryPortfolioRepository();
    await repo._seed("user-A", { ...samplePortfolio, name: "A's portfolio" });
    await repo._seed("user-B", { ...samplePortfolio, name: "B's portfolio" });
    await repo._seed("user-A", {
      ...samplePortfolio,
      name: "A's second portfolio",
    });

    const listA = await repo.listByUser("user-A");
    const listB = await repo.listByUser("user-B");

    expect(listA).toHaveLength(2);
    expect(listB).toHaveLength(1);
    expect(listA.every((p) => p.userId === "user-A")).toBe(true);
  });

  it("owner can delete their own portfolio", async () => {
    const repo = new MemoryPortfolioRepository();
    const created = await repo._seed("user-A", samplePortfolio);

    const deleted = await repo.remove("user-A", created.id);
    expect(deleted).toBe(true);
    expect(await repo.getById("user-A", created.id)).toBeNull();
  });

  it("getById returns null for a nonexistent id rather than throwing", async () => {
    const repo = new MemoryPortfolioRepository();
    await expect(repo.getById("user-A", "does-not-exist")).resolves.toBeNull();
  });
});

describe("DriftBaselineRepository ownership scoping", () => {
  it("creates and retrieves a drift baseline for its owner", async () => {
    const repo = new MemoryDriftBaselineRepository();

    const created = await repo.create("user-A", sampleBaseline);

    expect(created.portfolioId).toBe("portfolio-1");
    expect(created.userId).toBe("user-A");
    expect(created.returnsByTicker).toEqual(sampleBaseline.returnsByTicker);
    expect(created.createdAt).toBeTruthy();

    const retrieved = await repo.getByPortfolioId("user-A", "portfolio-1");

    expect(retrieved).toEqual(created);
  });

  it("does not let another user read the baseline", async () => {
    const repo = new MemoryDriftBaselineRepository();

    await repo.create("user-A", sampleBaseline);

    const asOther = await repo.getByPortfolioId("user-B", "portfolio-1");

    expect(asOther).toBeNull();
  });

  it("rejects a second baseline for the same portfolio", async () => {
    const repo = new MemoryDriftBaselineRepository();

    await repo.create("user-A", sampleBaseline);

    await expect(repo.create("user-A", sampleBaseline)).rejects.toThrow(
      "Drift baseline already exists for portfolio portfolio-1.",
    );
  });

  it("returns null for a nonexistent portfolio baseline", async () => {
    const repo = new MemoryDriftBaselineRepository();

    await expect(
      repo.getByPortfolioId("user-A", "does-not-exist"),
    ).resolves.toBeNull();
  });
});
