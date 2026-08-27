import type { OptimizeRequestInput } from "./validation";

export interface AssetWeight {
  ticker: string;
  weight: number;
}

export interface OptimizeResult {
  algorithm: string;
  weights: AssetWeight[];
  n_assets: number;
  n_nonzero: number;
  sparsity_pct: number;
  final_objective: number;
  n_iterations: number;
  wall_time_seconds: number;
}

export class SpoToolsError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "SpoToolsError";
  }
}

/**
 * Calls the live spo-tools API (a separate, stateless, publicly-callable
 * service — see its own repo). This is the only place spo-web talks to it,
 * so rate limits / auth / caching in front of spo-tools all have one place
 * to live if they're ever needed.
 */
export async function optimize(input: OptimizeRequestInput): Promise<OptimizeResult> {
  const baseUrl = process.env.SPO_TOOLS_URL;
  if (!baseUrl) {
    throw new Error("SPO_TOOLS_URL environment variable is not set");
  }

  const response = await fetch(`${baseUrl}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tickers: input.tickers,
      start: input.start,
      end: input.end,
      algorithm: input.algorithm,
      gamma: input.gamma,
      lam: input.lambda,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SpoToolsError(`spo-tools returned ${response.status}: ${body}`, response.status);
  }

  return (await response.json()) as OptimizeResult;
}
