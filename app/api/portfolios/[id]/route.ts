import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPortfolioRepository } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const repo = await getPortfolioRepository();
  // getById is scoped by userId inside the repository — a portfolio owned
  // by someone else returns null here, not a 403. That's deliberate: it
  // means "does this id exist" and "do you own it" are indistinguishable
  // from outside, so guessing/incrementing ids can't even confirm another
  // user's portfolio exists, let alone read it.
  const portfolio = await repo.getById(userId, id);
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(portfolio);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const repo = await getPortfolioRepository();
  const deleted = await repo.remove(userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
