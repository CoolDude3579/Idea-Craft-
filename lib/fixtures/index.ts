import { makeResult } from "@/lib/core/normalise";
import type { SourceResult } from "@/types/source-result";

import { FIXTURE_ROWS, type FixtureRow } from "./rows";

/**
 * Offline demo mode. With DEMO_FIXTURES=1 the fan-out reads these captured
 * provider payloads instead of the network, so the demo survives a bad
 * conference connection. Never enable it in a deployed build.
 */
export function fixturesEnabled(): boolean {
  return process.env.DEMO_FIXTURES === "1";
}

function toResult(row: FixtureRow): SourceResult | null {
  return makeResult({
    sourceId: row.sourceId,
    sourceKey: row.sourceKey,
    title: row.title,
    url: row.url,
    snippet: row.snippet ?? null,
    kind: row.kind,
    licence: row.licence,
    licenceUrl: row.licenceUrl ?? null,
    attribution: row.attribution ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    publishedAt: row.publishedAt ?? null,
    raw: { ...(row.raw ?? {}), fixture: true },
  });
}

export function fixtureFor(sourceId: string, query: string): SourceResult[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return FIXTURE_ROWS.filter((row) => row.sourceId === sourceId)
    .filter((row) => {
      if (tokens.length === 0) return true;
      const haystack = `${row.title} ${row.snippet ?? ""} ${row.tags.join(" ")}`.toLowerCase();
      return tokens.some((token) => haystack.includes(token));
    })
    .map(toResult)
    .filter((result): result is SourceResult => result !== null);
}
