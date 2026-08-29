import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getPortfolioRepository } from "@/lib/db";
import { AppHeader } from "../../components/AppHeader";
import { DeleteButton } from "./DeleteButton";
import { DriftCheck } from "./DriftCheck";

export default async function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const repo = await getPortfolioRepository();
  // Scoped by userId inside the repository — visiting someone else's
  // portfolio id here 404s exactly like a nonexistent one would.
  const portfolio = await repo.getById(userId, id);
  if (!portfolio) notFound();

  const active = portfolio.weights.filter((w) => w.weight > 0.001).sort((a, b) => b.weight - a.weight);

  return (
    <div className="flex-1 flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl text-foreground">{portfolio.name}</h1>
            <p className="text-xs text-muted mt-1">
              Saved {new Date(portfolio.createdAt).toLocaleDateString()} · {portfolio.algorithm} · γ={portfolio.gamma}{" "}
              · λ={portfolio.lambda}
            </p>
          </div>
          <DeleteButton portfolioId={portfolio.id} />
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="pb-2 font-normal">Ticker</th>
                <th className="pb-2 font-normal text-right">Weight</th>
              </tr>
            </thead>
            <tbody className="font-[family-name:var(--font-display)]">
              {active.map((w) => (
                <tr key={w.ticker} className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-foreground">{w.ticker}</td>
                  <td className="py-2 text-right text-accent">{(w.weight * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted space-y-1">
          <p>Universe: {portfolio.tickers.join(", ")}</p>
          <p>
            Training window: {portfolio.start} to {portfolio.end}
          </p>
          <p>Final objective: {portfolio.finalObjective.toFixed(6)}</p>
        </div>
        <DriftCheck portfolioId={portfolio.id} />
      </main>
    </div>
  );
}
