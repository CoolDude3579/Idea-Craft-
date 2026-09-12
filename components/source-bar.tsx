import type { SourceStatus } from "@/lib/core/federate";

function age(fetchedAt: string): string {
  const minutes = Math.round((Date.now() - Date.parse(fetchedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function SourceBar({
  sources,
  rawCount,
  dedupedCount,
  ms,
  cached = false,
  stale = false,
  fetchedAt,
}: {
  sources: readonly SourceStatus[];
  rawCount: number;
  dedupedCount: number;
  ms: number;
  cached?: boolean;
  stale?: boolean;
  fetchedAt?: string;
}) {
  return (
    <div className="sourcebar">
      {sources.map((source) => (
        <span key={source.sourceId} className={source.ok ? "pill" : "pill down"}>
          {source.label}: {source.ok ? `${source.count} in ${source.ms}ms` : "unavailable"}
        </span>
      ))}
      {/* A cached answer reported as a live one makes every timing in this bar
          a lie, and the staleness is exactly what a user needs to know. */}
      {cached ? (
        <span className={stale ? "pill down" : "pill"}>
          {stale ? "stale cache" : "cached"}
          {fetchedAt ? ` · fetched ${age(fetchedAt)}` : ""}
        </span>
      ) : null}
      <span>
        {rawCount} fetched · {rawCount - dedupedCount} duplicates collapsed · {ms}ms
        {cached ? " to serve" : " total"}
      </span>
    </div>
  );
}
