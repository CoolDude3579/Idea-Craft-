import type { SourceResult } from "@/types/source-result";

import { keywords, overlap } from "./keywords";
import { reuseScore } from "./licence";

export interface Scored {
  readonly result: SourceResult;
  readonly score: number;
  readonly reasons: readonly string[];
}

const WEIGHT = { title: 0.45, snippet: 0.2, licence: 0.25, recency: 0.1 } as const;

function recency(publishedAt: string | null): number {
  if (!publishedAt) return 0.35;
  const years = (Date.now() - Date.parse(publishedAt)) / 31_557_600_000;
  if (Number.isNaN(years)) return 0.35;
  if (years <= 0) return 1;
  return 1 / (1 + years / 8);
}

function score(result: SourceResult, queryTokens: readonly string[]): Scored {
  const titleHit = overlap(queryTokens, result.title);
  const snippetHit = result.snippet ? overlap(queryTokens, result.snippet) : 0;
  const licenceHit = reuseScore(result.licence);
  const recencyHit = recency(result.publishedAt);

  const reasons: string[] = [];
  if (titleHit >= 0.5) reasons.push("title match");
  if (licenceHit >= 0.85) reasons.push("freely reusable");
  if (Array.isArray(result.raw["alsoFoundIn"])) reasons.push("corroborated");

  return {
    result,
    score:
      titleHit * WEIGHT.title +
      snippetHit * WEIGHT.snippet +
      licenceHit * WEIGHT.licence +
      recencyHit * WEIGHT.recency,
    reasons,
  };
}

/**
 * Scores every result, then interleaves by source so one chatty provider
 * cannot own the first page.
 */
export function rerank(
  results: readonly SourceResult[],
  query: string,
  limit = 40,
): Scored[] {
  const queryTokens = keywords(query);
  const scored = results
    .map((result) => score(result, queryTokens))
    .sort((a, b) => b.score - a.score);

  const queues = new Map<string, Scored[]>();
  for (const item of scored) {
    const queue = queues.get(item.result.sourceId) ?? [];
    queue.push(item);
    queues.set(item.result.sourceId, queue);
  }

  const out: Scored[] = [];
  while (out.length < limit && queues.size > 0) {
    for (const [sourceId, queue] of [...queues.entries()]) {
      const next = queue.shift();
      if (!next) {
        queues.delete(sourceId);
        continue;
      }
      out.push(next);
      if (out.length >= limit) break;
    }
  }
  return out;
}
