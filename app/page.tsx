import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { SparsityGrid } from "./components/SparsityGrid";
import Image from "next/image"

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/spo-logo.png" alt="" width={24} height={24} />
            <span className="font-[family-name:var(--font-display)] text-sm text-foreground">SPO Web</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Show when="signed-out">
              <Link href="/sign-in" className="text-muted hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-background hover:bg-accent/90 transition-colors"
              >
                Sign up
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-background hover:bg-accent/90 transition-colors"
              >
                Dashboard
              </Link>
            </Show>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.2em] text-accent uppercase mb-4">
              Sparse portfolio optimisation
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl leading-tight text-foreground mb-6">
              Most positions
              <br />
              are noise.
              <br />
              <span className="text-accent">Find the ones that aren&apos;t.</span>
            </h1>
            <p className="text-muted text-lg leading-relaxed mb-8 max-w-md">
              Give it a list of tickers and a date range. Variance-reduced proximal gradient
              methods return a portfolio concentrated in a handful of positions —
              everything else driven to exactly zero, not just small.
            </p>
            <div className="flex items-center gap-4">
              <Show when="signed-out">
                <Link
                  href="/sign-up"
                  className="rounded-md bg-accent px-5 py-2.5 font-medium text-background hover:bg-accent/90 transition-colors"
                >
                  Build a portfolio
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard/new"
                  className="rounded-md bg-accent px-5 py-2.5 font-medium text-background hover:bg-accent/90 transition-colors"
                >
                  Build a portfolio
                </Link>
              </Show>
              <a
                href="https://github.com/chrisbsoo/spo-tools/blob/main/docs/thesis.pdf"
                className="text-sm text-muted hover:text-foreground transition-colors underline underline-offset-4"
              >
                Read the research
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-6">
            <SparsityGrid />
            <p className="mt-4 text-xs text-muted font-[family-name:var(--font-display)]">
              8 of 140 candidate assets selected — the rest, exactly zero.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 grid md:grid-cols-3 gap-8">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-sm text-accent mb-2">Four engines</h2>
              <p className="text-muted text-sm leading-relaxed">
                SPGD, Prox-SVRG, Prox-SARAH, Prox-STORM — pick the convergence/variance
                trade-off that fits, or take the recommended default.
              </p>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-sm text-accent mb-2">Two dials</h2>
              <p className="text-muted text-sm leading-relaxed">
                Risk-aversion and sparsity strength, exposed directly — not buried behind
                a black-box &quot;risk score.&quot;
              </p>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-sm text-accent mb-2">Real data</h2>
              <p className="text-muted text-sm leading-relaxed">
                Computed against actual historical returns, run by a variance-reduced
                stochastic optimiser with proven convergence guarantees.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted">
          Not financial advice. Historical performance does not guarantee future results.
        </div>
      </footer>
    </div>
  );
}
