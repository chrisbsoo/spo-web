import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOptimizeUsageRepository } from "@/lib/db";
import { optimize, SpoToolsError } from "@/lib/spo-tools-client";
import { optimizeRequestSchema } from "@/lib/validation";

const OPTIMIZE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usageRepo = await getOptimizeUsageRepository();
  const lastUsedAt = await usageRepo.getLastUsedAt(userId);

  if (lastUsedAt) {
    const elapsed = Date.now() - new Date(lastUsedAt).getTime();
    if (elapsed < OPTIMIZE_COOLDOWN_MS) {
      const retryAt = new Date(new Date(lastUsedAt).getTime() + OPTIMIZE_COOLDOWN_MS);
      return NextResponse.json(
        { error: `You can run one optimisation per hour. Try again at ${retryAt.toLocaleTimeString()}.` },
        { status: 429 },
      );
    }
  }

  const body = await request.json();
  const parsed = optimizeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const result = await optimize(parsed.data);
    await usageRepo.recordUsage(userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SpoToolsError) {
      const friendlyMessage =
        err.status === 429 ? "API limit reached, please try again in a minute." : err.message;
      return NextResponse.json({ error: friendlyMessage }, { status: err.status >= 500 ? 502 : err.status });
    }
    return NextResponse.json({ error: "Optimization failed" }, { status: 500 });
  }
}
