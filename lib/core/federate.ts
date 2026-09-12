import { fixtureFor, fixturesEnabled } from "@/lib/fixtures";
import type { SourceResult } from "@/types/source-result";

import type { Plan } from "./categories";
import { keyFor, readCache, writeCache, type CachedFanout } from "./cache";
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
  /** Served from the fan-out cache rather than the providers. */
  readonly cached: boolean;
  /** Cached past its TTL, served because the live fan-out came back empty. */
  readonly stale: boolean;
  /** When the providers were last actually asked. */
  readonly fetchedAt: string;
}

const LIMIT = 40;

/** Ranking is re-applied on every read, so a relevance fix is never stuck
    behind a cache TTL. */
function fromCache(
  plan: Plan,
  payload: CachedFanout,
  stale: boolean,
  startedAt: number,
): Federated {
  return {
    plan,
    items: rerank(payload.results, plan.query, LIMIT, plan.terms),
    sources: payload.sources,
    rawCount: payload.rawCount,
    dedupedCount: payload.dedupedCount,
    ms: Date.now() - startedAt,
    cached: true,
    stale,
    fetchedAt: payload.fetchedAt,
  };
}

/**
 * Fans the plan out to every adapter it names, in parallel. Adapters never
 * throw, but a hung one must not hold the page, so each is also wrapped.
 */
export async function federate(plan: Plan): Promise<Federated> {
  const startedAt = Date.now();

  // Fixtures are for offline demos; caching them would only confuse the
  // timings the source bar reports.
  const cacheable = !fixturesEnabled();
  const key = keyFor(plan.categoryId, plan.subcategoryId, plan.query);

  if (cacheable) {
    // A cache that can fail the request is worse than no cache.
    const hit = await readCache(key).catch(() => null);
    if (hit) return fromCache(plan, hit.payload, hit.stale, startedAt);
  }

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
  const sources = settled.map((entry) => entry.status);
  const fetchedAt = new Date().toISOString();

  if (cacheable && unique.length === 0) {
    // Every provider missed or fell over. A dead venue network should show the
    // last good answer, labelled stale, rather than an empty page.
    const fallback = await readCache(key, true).catch(() => null);
    if (fallback) return fromCache(plan, fallback.payload, true, startedAt);
  }

  // Only cache a real answer: storing an outage would pin the failure in place
  // for the whole TTL.
  if (cacheable && unique.length > 0 && sources.some((source) => source.ok)) {
    await writeCache(key, {
      results: unique,
      sources,
      rawCount: all.length,
      dedupedCount: unique.length,
      ms: Date.now() - startedAt,
      fetchedAt,
    }).catch(() => {
      // A cache write must never fail a search.
    });
  }

  return {
    plan,
    items: rerank(unique, plan.query, LIMIT, plan.terms),
    sources,
    rawCount: all.length,
    dedupedCount: unique.length,
    ms: Date.now() - startedAt,
    cached: false,
    stale: false,
    fetchedAt,
  };
}
