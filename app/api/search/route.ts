import { NextResponse } from "next/server";

import { CATEGORIES, planFor } from "@/lib/core/categories";
import { federate } from "@/lib/core/federate";

export const dynamic = "force-dynamic";
// A cold fan-out can take ~15s on a slow link (met alone is 12 sequential
// fetches). Vercel defaults serverless functions to 10s, which would 504
// the art category before the adapters give up.
export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const categoryId = url.searchParams.get("category") ?? "";
  const subcategoryId = url.searchParams.get("sub");

  if (!query.trim()) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const plan = planFor(categoryId, subcategoryId, query);
  if (!plan) {
    const known = CATEGORIES.find((c) => c.id === categoryId);
    return NextResponse.json(
      {
        error: known?.deferred ? "category is deferred" : "unknown category",
        categories: CATEGORIES.filter((c) => !c.deferred).map((c) => c.id),
      },
      { status: 400 },
    );
  }

  const federated = await federate(plan);

  return NextResponse.json({
    plan: federated.plan,
    sources: federated.sources,
    stats: {
      fetched: federated.rawCount,
      afterDedupe: federated.dedupedCount,
      ms: federated.ms,
    },
    results: federated.items.map((item) => ({
      score: Number(item.score.toFixed(4)),
      reasons: item.reasons,
      ...item.result,
    })),
  });
}
