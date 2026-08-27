"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { AppHeader } from "../../components/AppHeader";

interface AssetWeight {
  ticker: string;
  weight: number;
}

interface OptimizeResult {
  algorithm: string;
  weights: AssetWeight[];
  n_nonzero: number;
  sparsity_pct: number;
  final_objective: number;
  wall_time_seconds: number;
}

const ALGORITHMS = [
  { value: "prox-svrg", label: "Prox-SVRG (recommended)" },
  { value: "prox-sarah", label: "Prox-SARAH" },
  { value: "prox-storm", label: "Prox-STORM" },
  { value: "spgd", label: "SPGD (baseline)" },
];

export default function NewPortfolioPage() {
  const router = useRouter();
  const [tickerInput, setTickerInput] = useState("AAPL, MSFT, GOOGL, AMZN, NVDA, JPM, XOM, KO");
  const [start, setStart] = useState("2020-01-01");
  const [end, setEnd] = useState("2025-01-01");
  const [algorithm, setAlgorithm] = useState("prox-svrg");
  const [gamma, setGamma] = useState(2.0);
  const [lambda, setLambda] = useState(0.01);
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);

  const tickers = tickerInput
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  async function runOptimization() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers, start, end, algorithm, gamma, lambda }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Optimization failed");
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function savePortfolio() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || `${tickers.slice(0, 3).join("/")} portfolio`,
          request: { tickers, start, end, algorithm, gamma, lambda },
          result: {
            weights: result.weights,
            finalObjective: result.final_objective,
            sparsityPct: result.sparsity_pct,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      router.push(`/dashboard/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  const chartData = result?.weights
    .filter((w) => w.weight > 0.001)
    .sort((a, b) => b.weight - a.weight)
    .map((w) => ({ ticker: w.ticker, weight: Math.round(w.weight * 1000) / 10 }));

  return (
    <div className="flex-1 flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10 flex-1 space-y-8">
        <h1 className="font-[family-name:var(--font-display)] text-xl text-foreground">New portfolio</h1>

        <div className="rounded-lg border border-border bg-surface p-6 space-y-6">
          <div>
            <label className="block text-sm text-muted mb-2" htmlFor="tickers">
              Tickers (comma-separated)
            </label>
            <input
              id="tickers"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-foreground font-[family-name:var(--font-display)] text-sm"
              placeholder="AAPL, MSFT, GOOGL"
            />
            <p className="text-xs text-muted mt-1">{tickers.length} tickers parsed</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-2" htmlFor="start">
                Start date
              </label>
              <input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-2" htmlFor="end">
                End date
              </label>
              <input
                id="end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-foreground text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted mb-2" htmlFor="algorithm">
              Engine
            </label>
            <select
              id="algorithm"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-foreground text-sm"
            >
              {ALGORITHMS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="flex justify-between text-sm text-muted mb-2" htmlFor="gamma">
                <span>Risk aversion</span>
                <span className="font-[family-name:var(--font-display)] text-foreground">{gamma.toFixed(1)}</span>
              </label>
              <input
                id="gamma"
                type="range"
                min={0.1}
                max={10}
                step={0.1}
                value={gamma}
                onChange={(e) => setGamma(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
            </div>
            <div>
              <label className="flex justify-between text-sm text-muted mb-2" htmlFor="lambda">
                <span>Sparsity strength</span>
                <span className="font-[family-name:var(--font-display)] text-foreground">{lambda.toFixed(3)}</span>
              </label>
              <input
                id="lambda"
                type="range"
                min={0}
                max={0.1}
                step={0.001}
                value={lambda}
                onChange={(e) => setLambda(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>Diversified</span>
                <span>Concentrated</span>
              </div>
            </div>
          </div>

          <button
            onClick={runOptimization}
            disabled={loading || tickers.length < 2}
            className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-background hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Running…" : "Run optimisation"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {result && chartData && (
          <div className="rounded-lg border border-border bg-surface p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-sm text-foreground">Allocation</h2>
              <span className="text-xs text-muted">
                {result.n_nonzero} active · {result.sparsity_pct.toFixed(0)}% sparse ·{" "}
                {result.wall_time_seconds.toFixed(2)}s
              </span>
            </div>

            <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232B35" horizontal={false} />
                <XAxis type="number" domain={[0, "dataMax"]} tick={{ fill: "#7C8894", fontSize: 12 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  tick={{ fill: "#E8EDF2", fontSize: 12, fontFamily: "var(--font-display)" }}
                  width={60}
                />
                <Bar dataKey="weight" fill="#FFB000" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center gap-3 pt-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this portfolio"
                className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground"
              />
              <button
                onClick={savePortfolio}
                disabled={saving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
