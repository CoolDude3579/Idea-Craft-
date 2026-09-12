import type { SourceStatus } from "@/lib/core/federate";

export function SourceBar({
  sources,
  rawCount,
  dedupedCount,
  ms,
}: {
  sources: readonly SourceStatus[];
  rawCount: number;
  dedupedCount: number;
  ms: number;
}) {
  return (
    <div className="sourcebar">
      {sources.map((source) => (
        <span key={source.sourceId} className={source.ok ? "pill" : "pill down"}>
          {source.label}: {source.ok ? `${source.count} in ${source.ms}ms` : "unavailable"}
        </span>
      ))}
      <span>
        {rawCount} fetched · {rawCount - dedupedCount} duplicates collapsed · {ms}ms total
      </span>
    </div>
  );
}
