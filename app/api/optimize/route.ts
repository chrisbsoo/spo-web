import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { optimize, SpoToolsError } from "@/lib/spo-tools-client";
import { optimizeRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = optimizeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const result = await optimize(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SpoToolsError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 500 ? 502 : err.status });
    }
    return NextResponse.json({ error: "Optimization failed" }, { status: 500 });
  }
}
