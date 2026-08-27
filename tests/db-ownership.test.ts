import { describe, expect, it } from "vitest";
import { MemoryPortfolioRepository } from "@/lib/db/memory";
import type { NewPortfolio } from "@/lib/db/types";

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
    await repo._seed("user-A", { ...samplePortfolio, name: "A's second portfolio" });

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
