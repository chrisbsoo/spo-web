import { describe, expect, it } from "vitest";

import {
  calculateKSStatistic,
  calculateKSTest,
  calculateMean,
  calculatePSI,
  calculateVariance,
} from "../lib/drift/statistics";

describe("calculateMean", () => {
  it("calculates the arithmetic mean", () => {
    expect(calculateMean([1, 2, 3])).toBe(2);
  });

  it("throws for an empty array", () => {
    expect(() => calculateMean([])).toThrow(
      "Cannot calculate mean of an empty array.",
    );
  });
});

describe("calculateVariance", () => {
  it("calculates the population variance", () => {
    expect(calculateVariance([1, 2, 3])).toBeCloseTo(2 / 3);
  });

  it("returns zero when all values are identical", () => {
    expect(calculateVariance([4, 4, 4])).toBe(0);
  });

  it("throws for an empty array", () => {
    expect(() => calculateVariance([])).toThrow(
      "Cannot calculate variance of an empty array.",
    );
  });
});

describe("calculatePSI", () => {
  it("returns zero for identical distributions", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);

    expect(calculatePSI(baseline, [...baseline])).toBeCloseTo(0);
  });

  it("returns a positive value when the distribution shifts", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);
    const monitored = baseline.map((value) => value + 50);

    expect(calculatePSI(baseline, monitored)).toBeGreaterThan(0);
  });

  it("throws when either distribution is empty", () => {
    expect(() => calculatePSI([], [1, 2, 3])).toThrow(
      "PSI requires non-empty baseline and monitored returns.",
    );

    expect(() => calculatePSI([1, 2, 3], [])).toThrow(
      "PSI requires non-empty baseline and monitored returns.",
    );
  });

  it("rejects an invalid number of bins", () => {
    const baseline = [1, 2, 3, 4, 5];

    expect(() => calculatePSI(baseline, baseline, 1)).toThrow(
      "PSI requires at least two bins.",
    );

    expect(() => calculatePSI(baseline, baseline, 2.5)).toThrow(
      "PSI requires at least two bins.",
    );
  });

  it("rejects more bins than baseline observations", () => {
    const baseline = [1, 2, 3];

    expect(() => calculatePSI(baseline, baseline, 4)).toThrow(
      "PSI cannot use more bins than baseline observations.",
    );
  });
});

describe("calculateKSStatistic", () => {
  it("returns zero for identical distributions", () => {
    const baseline = [1, 2, 3, 4, 5];

    expect(calculateKSStatistic(baseline, [...baseline])).toBe(0);
  });

  it("returns one for completely separated distributions", () => {
    const baseline = [1, 2, 3];
    const monitored = [4, 5, 6];

    expect(calculateKSStatistic(baseline, monitored)).toBe(1);
  });

  it("throws when either distribution is empty", () => {
    expect(() => calculateKSStatistic([], [1, 2, 3])).toThrow(
      "KS requires non-empty baseline and monitored returns.",
    );

    expect(() => calculateKSStatistic([1, 2, 3], [])).toThrow(
      "KS requires non-empty baseline and monitored returns.",
    );
  });
});

describe("calculateKSTest", () => {
  it("returns statistic zero and p-value one for identical distributions", () => {
    const baseline = [1, 2, 3, 4, 5];

    expect(calculateKSTest(baseline, [...baseline])).toEqual({
      statistic: 0,
      pValue: 1,
    });
  });

  it("returns a small p-value for clearly separated distributions", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);
    const monitored = baseline.map((value) => value + 200);

    const result = calculateKSTest(baseline, monitored);

    expect(result.statistic).toBe(1);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("always returns a valid probability", () => {
    const baseline = Array.from({ length: 100 }, (_, index) => index);
    const monitored = baseline.map((value) => value + 20);

    const result = calculateKSTest(baseline, monitored);

    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });
});
