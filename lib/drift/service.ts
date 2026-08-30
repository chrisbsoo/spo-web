import type {
  DriftInput,
  DriftMetrics,
  DriftStatus,
  MultiTickerDriftInput,
  MultiTickerDriftMetrics,
} from "./types";

import {
  calculateKSTest,
  calculateMean,
  calculatePSI,
  calculateVariance,
} from "./statistics";

const PSI_WARNING_THRESHOLD = 0.1;
const PSI_DRIFT_THRESHOLD = 0.25;
const KS_SIGNIFICANCE_LEVEL = 0.05;

function determineDriftStatus(
  psi: number,
  ksPValue: number,
): DriftMetrics["status"] {
  if (psi >= PSI_DRIFT_THRESHOLD) {
    return "drift";
  }

  if (psi >= PSI_WARNING_THRESHOLD || ksPValue < KS_SIGNIFICANCE_LEVEL) {
    return "warning";
  }

  return "stable";
}

function getWorstStatus(statuses: DriftStatus[]): DriftStatus {
  if (statuses.includes("drift")) {
    return "drift";
  }

  if (statuses.includes("warning")) {
    return "warning";
  }

  return "stable";
}

export function calculateDriftMetrics(input: DriftInput): DriftMetrics {
  const { baselineReturns, monitoredReturns } = input;

  const baselineMean = calculateMean(baselineReturns);
  const monitoredMean = calculateMean(monitoredReturns);

  const baselineVariance = calculateVariance(baselineReturns);
  const monitoredVariance = calculateVariance(monitoredReturns);

  const psi = calculatePSI(baselineReturns, monitoredReturns);

  const { statistic: ksStatistic, pValue: ksPValue } = calculateKSTest(
    baselineReturns,
    monitoredReturns,
  );

  const status = determineDriftStatus(psi, ksPValue);

  return {
    baselineMean,
    monitoredMean,
    baselineVariance,
    monitoredVariance,
    psi,
    ksStatistic,
    ksPValue,
    status,
  };
}

export function calculateMultiTickerDriftMetrics(
  input: MultiTickerDriftInput,
): MultiTickerDriftMetrics {
  const tickers = Object.keys(input.returnsByTicker);

  if (tickers.length === 0) {
    throw new Error("At least one ticker drift input is required.");
  }

  const metricsByTicker: Record<string, DriftMetrics> = {};

  for (const ticker of tickers) {
    metricsByTicker[ticker] = calculateDriftMetrics(
      input.returnsByTicker[ticker],
    );
  }

  const overallStatus = getWorstStatus(
    Object.values(metricsByTicker).map((metrics) => metrics.status),
  );

  return {
    metricsByTicker,
    overallStatus,
  };
}
