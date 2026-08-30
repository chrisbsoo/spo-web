import { describe, expect, it } from "vitest";

import {
  calculateDriftMetrics,
  calculateMultiTickerDriftMetrics,
} from "../lib/drift/service";

describe("calculateDriftMetrics", () => {
  it("returns stable for identical distributions", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);

    const result = calculateDriftMetrics({
      baselineReturns: baseline,
      monitoredReturns: [...baseline],
    });

    expect(result.psi).toBeCloseTo(0);
    expect(result.ksStatistic).toBe(0);
    expect(result.ksPValue).toBe(1);
    expect(result.status).toBe("stable");
  });

  it("returns warning for moderate distribution drift", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);
    const monitored = baseline.map((value) => value + 7);

    const result = calculateDriftMetrics({
      baselineReturns: baseline,
      monitoredReturns: monitored,
    });

    expect(result.psi).toBeGreaterThanOrEqual(0.1);
    expect(result.psi).toBeLessThan(0.25);
    expect(result.status).toBe("warning");
  });

  it("returns drift for substantial distribution drift", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);
    const monitored = baseline.map((value) => value + 10);

    const result = calculateDriftMetrics({
      baselineReturns: baseline,
      monitoredReturns: monitored,
    });

    expect(result.psi).toBeGreaterThanOrEqual(0.25);
    expect(result.status).toBe("drift");
  });
});

describe("calculateMultiTickerDriftMetrics", () => {
  it("returns stable when all tickers are stable", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);

    const result = calculateMultiTickerDriftMetrics({
      returnsByTicker: {
        AAPL: {
          baselineReturns: baseline,
          monitoredReturns: [...baseline],
        },
        MSFT: {
          baselineReturns: baseline,
          monitoredReturns: [...baseline],
        },
      },
    });

    expect(result.metricsByTicker.AAPL.status).toBe("stable");
    expect(result.metricsByTicker.MSFT.status).toBe("stable");
    expect(result.overallStatus).toBe("stable");
  });

  it("returns warning when at least one ticker is warning", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);

    const result = calculateMultiTickerDriftMetrics({
      returnsByTicker: {
        AAPL: {
          baselineReturns: baseline,
          monitoredReturns: [...baseline],
        },
        MSFT: {
          baselineReturns: baseline,
          monitoredReturns: baseline.map((value) => value + 7),
        },
      },
    });

    expect(result.metricsByTicker.AAPL.status).toBe("stable");
    expect(result.metricsByTicker.MSFT.status).toBe("warning");
    expect(result.overallStatus).toBe("warning");
  });

  it("returns drift when at least one ticker is drift", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);

    const result = calculateMultiTickerDriftMetrics({
      returnsByTicker: {
        AAPL: {
          baselineReturns: baseline,
          monitoredReturns: baseline.map((value) => value + 7),
        },
        MSFT: {
          baselineReturns: baseline,
          monitoredReturns: baseline.map((value) => value + 10),
        },
      },
    });

    expect(result.metricsByTicker.AAPL.status).toBe("warning");
    expect(result.metricsByTicker.MSFT.status).toBe("drift");
    expect(result.overallStatus).toBe("drift");
  });

  it("rejects an empty ticker input", () => {
    expect(() =>
      calculateMultiTickerDriftMetrics({
        returnsByTicker: {},
      }),
    ).toThrow("At least one ticker drift input is required.");
  });
});
