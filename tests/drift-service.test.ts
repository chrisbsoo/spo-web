import { describe, expect, it } from "vitest";

import { calculateDriftMetrics } from "../lib/drift/service";

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