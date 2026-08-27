import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortfolioRepository } from "@/lib/db";
import { AppHeader } from "../components/AppHeader";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const repo = await getPortfolioRepository();
  const portfolios = await repo.listByUser(userId);

  return (
    <div className="flex-1 flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10 flex-1">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-xl text-foreground">Your portfolios</h1>
          <Link
            href="/dashboard/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent/90 transition-colors"
          >
            New portfolio
          </Link>
        </div>

        {portfolios.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-muted mb-4">Nothing here yet. Build your first allocation.</p>
            <Link
              href="/dashboard/new"
              className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent/90 transition-colors"
            >
              New portfolio
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {portfolios.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-4 hover:border-accent/50 transition-colors"
                >
                  <div>
                    <p className="text-foreground font-medium">{p.name}</p>
                    <p className="text-xs text-muted mt-1 font-[family-name:var(--font-display)]">
                      {p.tickers.length} tickers · {p.algorithm} · {p.weights.filter((w) => w.weight > 0).length}{" "}
                      active
                    </p>
                  </div>
                  <span className="text-xs text-muted">{new Date(p.createdAt).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
