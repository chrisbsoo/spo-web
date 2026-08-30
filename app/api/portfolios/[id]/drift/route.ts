import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getDriftBaselineRepository,
  getPortfolioRepository,
} from "@/lib/db";
import {
  fetchReturnsSinceDateForTickers,
  groupAlignedReturnsByTicker,
} from "@/lib/drift/market-data";
import { calculateMultiTickerDriftMetrics } from "@/lib/drift/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const portfolioRepo = await getPortfolioRepository();
  const portfolio = await portfolioRepo.getById(
    userId,
    id,
  );

  if (!portfolio) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 },
    );
  }

  const baselineRepo =
    await getDriftBaselineRepository();

  const baseline =
    await baselineRepo.getByPortfolioId(
      userId,
      id,
    );

  if (!baseline) {
    return NextResponse.json(
      { error: "Drift baseline not found" },
      { status: 404 },
    );
  }

  try {
    const tomorrow = new Date();
    tomorrow.setUTCDate(
      tomorrow.getUTCDate() + 1,
    );

    const monitoringEnd =
      tomorrow.toISOString().slice(0, 10);

    if (baseline.end >= monitoringEnd) {
      return NextResponse.json(
        {
          error:
            "No new market data available since the baseline period.",
        },
        { status: 409 },
      );
    }

    const tickers = Object.keys(
      baseline.returnsByTicker,
    );

    const monitoredRows =
      await fetchReturnsSinceDateForTickers(
        tickers,
        baseline.end,
        monitoringEnd,
      );

    if (monitoredRows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No new market data available since the baseline period.",
        },
        { status: 409 },
      );
    }

    const monitoredReturns =
      groupAlignedReturnsByTicker(
        monitoredRows,
      );

    const returnsByTicker =
      Object.fromEntries(
        tickers.map((ticker) => [
          ticker,
          {
            baselineReturns:
              baseline.returnsByTicker[ticker],
            monitoredReturns:
              monitoredReturns[ticker],
          },
        ]),
      );

    const metrics =
      calculateMultiTickerDriftMetrics({
        returnsByTicker,
      });

    return NextResponse.json({
      portfolioId: portfolio.id,
      baselineStart: baseline.start,
      baselineEnd: baseline.end,
      monitoringEnd,
      monitoredObservations:
        monitoredRows.length,
      ...metrics,
    });
  } catch (error) {
    console.error(
      "Failed to check portfolio drift:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to check portfolio drift" },
      { status: 500 },
    );
  }
}