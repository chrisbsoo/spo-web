import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDriftBaselineRepository, getPortfolioRepository } from "@/lib/db";
import {
  fetchAlignedReturnsForTickers,
  groupAlignedReturnsByTicker,
} from "@/lib/drift/market-data";
import { savePortfolioSchema } from "@/lib/validation";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = await getPortfolioRepository();
  const portfolios = await repo.listByUser(userId);
  return NextResponse.json(portfolios);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = savePortfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { name, request: req, result } = parsed.data;

  try {
    const alignedReturns = await fetchAlignedReturnsForTickers(
      req.tickers,
      req.start,
      req.end,
    );

    const returnsByTicker = groupAlignedReturnsByTicker(alignedReturns);

    const portfolioRepo = await getPortfolioRepository();
    const baselineRepo = await getDriftBaselineRepository();

    const portfolio = await portfolioRepo.create(userId, {
      name,
      tickers: req.tickers,
      start: req.start,
      end: req.end,
      algorithm: req.algorithm,
      gamma: req.gamma,
      lambda: req.lambda,
      weights: result.weights,
      finalObjective: result.finalObjective,
      sparsityPct: result.sparsityPct,
    });

    try {
      await baselineRepo.create(userId, {
        portfolioId: portfolio.id,
        returnsByTicker,
        start: req.start,
        end: req.end,
      });
    } catch (error) {
      await portfolioRepo.remove(userId, portfolio.id);
      throw error;
    }

    return NextResponse.json(portfolio, { status: 201 });
  } catch (error) {
    console.error("Failed to save portfolio with drift baseline:", error);

    return NextResponse.json(
      { error: "Failed to save portfolio" },
      { status: 500 },
    );
  }
}
