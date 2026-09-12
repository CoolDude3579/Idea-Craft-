import { eq, lt } from "drizzle-orm";

import { getDb, schema } from "@/db";
import type { SourceResult } from "@/types/source-result";

import type { SourceStatus } from "./federate";
import { cacheKey } from "./keywords";

/**
 * The fan-out cache. `searchCache` has been in the schema since the first
 * commit and nothing ever read or wrote it, so every search hit all seven
 * providers live: latency and provider cost scaled linearly with traffic, and
 * the documented rate limits were one busy minute away from being breached.
 *
 * Raw provider results are cached, not the ranked page. Ranking is cheap and
 * changes often — caching its output would freeze every relevance fix behind a
 * TTL, and re-ranking on read costs microseconds.
 */
export interface CachedFanout {
  readonly results: readonly SourceResult[];
  readonly sources: readonly SourceStatus[];
  readonly rawCount: number;
  readonly dedupedCount: number;
  readonly ms: number;
  /** When the providers were actually asked, so staleness can be reported. */
  readonly fetchedAt: string;
}

const TTL_MS = 6 * 60 * 60 * 1000;

/** Without DATABASE_URL the cache lives in the process, like ideas do. */
const memory = new Map<string, { payload: CachedFanout; expiresAt: number }>();

/** Bounded, because a long-running dev server would otherwise hold every
    query's full provider payload for the life of the process. Map preserves
    insertion order, so the oldest entry is the first key. */
const MEMORY_MAX = 200;

export function keyFor(
  categoryId: string,
  subcategoryId: string | null,
  query: string,
): string {
  return cacheKey([categoryId, subcategoryId ?? "-", query]);
}

export interface CacheHit {
  readonly payload: CachedFanout;
  /** True when served past its TTL, which only happens as an outage fallback. */
  readonly stale: boolean;
}

/**
 * `allowStale` is for the case where the live fan-out came back empty: a dead
 * venue network should show yesterday's results, labelled, rather than an empty
 * page.
 */
export async function readCache(
  key: string,
  allowStale = false,
): Promise<CacheHit | null> {
  const db = getDb();

  if (!db) {
    const entry = memory.get(key);
    if (!entry) return null;
    const stale = entry.expiresAt <= Date.now();
    if (stale && !allowStale) return null;
    return { payload: entry.payload, stale };
  }

  const [row] = await db
    .select()
    .from(schema.searchCache)
    .where(eq(schema.searchCache.key, key));
  if (!row) return null;

  const stale = row.expiresAt.getTime() <= Date.now();
  if (stale && !allowStale) return null;
  return { payload: row.payload as CachedFanout, stale };
}

export async function writeCache(key: string, payload: CachedFanout): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const db = getDb();

  if (!db) {
    memory.delete(key); // re-insert so refreshed entries count as newest
    memory.set(key, { payload, expiresAt: expiresAt.getTime() });
    while (memory.size > MEMORY_MAX) {
      const oldest = memory.keys().next();
      if (oldest.done) break;
      memory.delete(oldest.value);
    }
    return;
  }

  await db
    .insert(schema.searchCache)
    .values({ key, payload, expiresAt })
    .onConflictDoUpdate({
      target: schema.searchCache.key,
      set: { payload, expiresAt },
    });

  // Cheap opportunistic sweep: the table is keyed by query, so it would grow
  // without bound otherwise. Expired rows a stale read might still want are
  // kept for one further TTL.
  await db
    .delete(schema.searchCache)
    .where(lt(schema.searchCache.expiresAt, new Date(Date.now() - TTL_MS)));
}
