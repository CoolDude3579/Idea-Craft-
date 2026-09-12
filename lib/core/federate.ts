import { fixtureFor, fixturesEnabled } from "@/lib/fixtures";
import type { SourceResult } from "@/types/source-result";

import type { Plan } from "./categories";
import { dedupe } from "./dedupe";
import { rerank, type Scored } from "./rerank";
import { takeFailure } from "./http";
import { adaptersFor } from "./registry";

export interface SourceStatus {
  readonly sourceId: string;
  readonly label: string;
  readonly count: number;
  readonly ms: number;
  readonly ok: boolean;
  /** Why the source produced nothing, when it failed rather than missed. */
  readonly error: string | null;
}

export interface Federated {
  readonly plan: Plan;
  readonly items: readonly Scored[];
  readonly sources: readonly SourceStatus[];
  readonly rawCount: number;
  readonly dedupedCount: number;
  readonly ms: number;
}

const LIMIT = 40;

/**
 * Fans the plan out to every adapter it names, in parallel. Adapters never
 * throw, but a hung one must not hold the page, so each is also wrapped.
 */
export async function federate(plan: Plan): Promise<Federated> {
  const startedAt = Date.now();
  const adapters = adaptersFor(plan.sourceIds);

  const settled = await Promise.all(
    adapters.map(async (adapter) => {
      const from = Date.now();
      try {
        const results = fixturesEnabled()
          ? fixtureFor(adapter.sourceId, plan.query)
          : await adapter.search(plan.query);
        // Adapters swallow their own errors, so an empty list is ambiguous
        // until the failure channel is consulted.
        const failure = takeFailure(adapter.sourceId);
        return {
          status: {
            sourceId: adapter.sourceId,
            label: adapter.label,
            count: results.length,
            ms: Date.now() - from,
            ok: failure === null,
            error: failure,
          } satisfies SourceStatus,
          results,
        };
      } catch (error) {
        console.error(`[${adapter.sourceId}] ${(error as Error).message}`);
        return {
          status: {
            sourceId: adapter.sourceId,
            label: adapter.label,
            count: 0,
            ms: Date.now() - from,
            ok: false,
            error: (error as Error).message,
          } satisfies SourceStatus,
          results: [] as SourceResult[],
        };
      }
    }),
  );

  const all = settled.flatMap((entry) => entry.results);
  const unique = dedupe(all);

  return {
    plan,
    items: rerank(unique, plan.query, LIMIT, plan.terms),
    sources: settled.map((entry) => entry.status),
    rawCount: all.length,
    dedupedCount: unique.length,
    ms: Date.now() - startedAt,
  };
}
