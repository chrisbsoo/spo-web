import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPortfolioRepository } from "@/lib/db";
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
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 422 });
  }

  const { name, request: req, result } = parsed.data;
  const repo = await getPortfolioRepository();
  const portfolio = await repo.create(userId, {
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

  return NextResponse.json(portfolio, { status: 201 });
}
