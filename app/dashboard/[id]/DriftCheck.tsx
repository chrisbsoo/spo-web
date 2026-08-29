"use client";

import { useState } from "react";

type DriftStatus = "stable" | "warning" | "drift";

interface DriftMetrics {
  baselineMean: number;
  monitoredMean: number;
  baselineVariance: number;
  monitoredVariance: number;
  psi: number;
  ksStatistic: number;
  ksPValue: number;
  status: DriftStatus;
}

interface DriftCheckResult {
  portfolioId: string;
  baselineStart: string;
  baselineEnd: string;
  monitoringEnd: string;
  monitoredObservations: number;
  metricsByTicker: Record<string, DriftMetrics>;
  overallStatus: DriftStatus;
}

export function DriftCheck({
  portfolioId,
}: {
  portfolioId: string;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] =
    useState<DriftCheckResult | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/portfolios/${portfolioId}/drift`,
      );

      const body = await response.json();

      if (!response.ok) {
        setResult(null);
        setError(
          body.error ?? "Failed to check portfolio drift.",
        );
        return;
      }

      setResult(body as DriftCheckResult);
    } catch {
      setResult(null);
      setError("Failed to check portfolio drift.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-foreground">
            Data drift
          </h2>
          <p className="text-xs text-muted mt-1">
            Compare recent market returns with the
            frozen optimisation baseline.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:border-accent transition-colors disabled:opacity-40"
        >
          {checking ? "Checking…" : "Check drift"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted">
              Overall status:{" "}
            </span>
            <span className="font-[family-name:var(--font-display)] text-foreground uppercase">
              {result.overallStatus}
            </span>
          </div>

          <div className="text-xs text-muted">
            Compared {result.monitoredObservations} new
            return observations against the baseline from{" "}
            {result.baselineStart} to{" "}
            {result.baselineEnd}.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="pb-2 font-normal">
                    Ticker
                  </th>
                  <th className="pb-2 font-normal text-right">
                    Status
                  </th>
                  <th className="pb-2 font-normal text-right">
                    PSI
                  </th>
                  <th className="pb-2 font-normal text-right">
                    KS
                  </th>
                  <th className="pb-2 font-normal text-right">
                    KS p-value
                  </th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(
                  result.metricsByTicker,
                ).map(([ticker, metrics]) => (
                  <tr
                    key={ticker}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 text-foreground">
                      {ticker}
                    </td>
                    <td className="py-2 text-right text-foreground uppercase">
                      {metrics.status}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {metrics.psi.toFixed(3)}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {metrics.ksStatistic.toFixed(3)}
                    </td>
                    <td className="py-2 text-right text-muted">
                      {metrics.ksPValue.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.overallStatus === "drift" && (
            <p className="text-sm text-danger">
              Significant drift detected. Consider
              rerunning the optimisation with a newer
              training period.
            </p>
          )}

          {result.overallStatus === "warning" && (
            <p className="text-sm text-muted">
              Some evidence of drift was detected. Review
              the ticker-level metrics before deciding
              whether to rerun the optimisation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}