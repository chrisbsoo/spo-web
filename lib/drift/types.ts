export type DriftStatus = "stable" | "warning" | "drift";

export interface DriftInput {
  baselineReturns: number[];
  monitoredReturns: number[];
}

export interface DriftMetrics {
  baselineMean: number;
  monitoredMean: number;

  baselineVariance: number;
  monitoredVariance: number;

  psi: number;
  ksStatistic: number;
  ksPValue: number;

  status: DriftStatus;
}

export interface MultiTickerDriftInput {
  returnsByTicker: Record<string, DriftInput>;
}

export interface MultiTickerDriftMetrics {
  metricsByTicker: Record<string, DriftMetrics>;
  overallStatus: DriftStatus;
}
