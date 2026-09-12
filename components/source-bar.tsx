import type { SourceStatus } from "@/lib/core/federate";

function age(fetchedAt: string): string {
  const minutes = Math.round((Date.now() - Date.parse(fetchedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function ms(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

/**
 * The proof that the fan-out is real: one pill per provider with its count and
 * timing, a dot that goes amber when a source failed, and the dedupe summary.
 * A cached answer says so, because otherwise every timing here is a lie.
 */
export function SourceBar({
  sources,
  rawCount,
  dedupedCount,
  ms: total,
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
    <>
      {stale ? (
        <p className="autherror" style={{ marginTop: 16 }}>
          Every provider came back empty, so these are the last good results
          {fetchedAt ? ` from ${fetchedAt.slice(0, 10)}` : ""} — they may be out
          of date.
        </p>
      ) : null}

      <div className="sources">
        {sources.map((source) => (
          <span
            className={source.ok ? "srcpill" : "srcpill down"}
            key={source.sourceId}
            title={source.error ?? undefined}
          >
            {source.label}
            {source.ok ? (
              <>
                {" "}
                {source.count} {source.count === 1 ? "result" : "results"}{" "}
                <span className="ms">({ms(source.ms)})</span>
              </>
            ) : (
              " unavailable"
            )}
          </span>
        ))}

        {cached ? (
          <span className={stale ? "srcpill down" : "srcpill"}>
            {stale ? "stale cache" : "served from cache"}
            {fetchedAt ? ` · asked the providers ${age(fetchedAt)}` : ""}
          </span>
        ) : null}

        <span>
          {rawCount} fetched · {rawCount - dedupedCount} duplicates collapsed ·{" "}
          {ms(total)} {cached ? "to serve" : "total"}
        </span>
      </div>
    </>
  );
}

export default SourceBar;
