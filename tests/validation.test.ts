import { describe, expect, it } from "vitest";
import { optimizeRequestSchema, savePortfolioSchema } from "@/lib/validation";

describe("optimizeRequestSchema", () => {
  const valid = {
    tickers: ["AAPL", "MSFT"],
    start: "2020-01-01",
    end: "2025-01-01",
  };

  it("accepts a minimal valid request and fills in defaults", () => {
    const parsed = optimizeRequestSchema.parse(valid);
    expect(parsed.algorithm).toBe("prox-svrg");
    expect(parsed.gamma).toBe(2.0);
    expect(parsed.lambda).toBe(0.01);
  });

  it("rejects fewer than 2 tickers", () => {
    const result = optimizeRequestSchema.safeParse({ ...valid, tickers: ["AAPL"] });
    expect(result.success).toBe(false);
  });

  it("rejects lowercase or malformed tickers", () => {
    const result = optimizeRequestSchema.safeParse({ ...valid, tickers: ["aapl", "MSFT"] });
    expect(result.success).toBe(false);
  });

  it("rejects start date on or after end date", () => {
    const result = optimizeRequestSchema.safeParse({ ...valid, start: "2025-01-01", end: "2020-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects gamma outside [0.1, 10]", () => {
    expect(optimizeRequestSchema.safeParse({ ...valid, gamma: 0 }).success).toBe(false);
    expect(optimizeRequestSchema.safeParse({ ...valid, gamma: 15 }).success).toBe(false);
    expect(optimizeRequestSchema.safeParse({ ...valid, gamma: 5 }).success).toBe(true);
  });

  it("rejects an unknown algorithm", () => {
    const result = optimizeRequestSchema.safeParse({ ...valid, algorithm: "made-up-algo" });
    expect(result.success).toBe(false);
  });

  it("rejects more than 30 tickers", () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `TICK${i}`);
    const result = optimizeRequestSchema.safeParse({ ...valid, tickers: tooMany });
    expect(result.success).toBe(false);
  });
});

describe("savePortfolioSchema", () => {
  it("accepts a full valid save payload", () => {
    const payload = {
      name: "My tech tilt",
      request: {
        tickers: ["AAPL", "MSFT"],
        start: "2020-01-01",
        end: "2025-01-01",
        algorithm: "prox-svrg",
        gamma: 2.0,
        lambda: 0.01,
      },
      result: {
        weights: [
          { ticker: "AAPL", weight: 0.6 },
          { ticker: "MSFT", weight: 0.4 },
        ],
        finalObjective: 0.008,
        sparsityPct: 0,
      },
    };
    expect(savePortfolioSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const payload = {
      name: "",
      request: { tickers: ["AAPL", "MSFT"], start: "2020-01-01", end: "2025-01-01" },
      result: { weights: [], finalObjective: 0, sparsityPct: 0 },
    };
    expect(savePortfolioSchema.safeParse(payload).success).toBe(false);
  });
});
