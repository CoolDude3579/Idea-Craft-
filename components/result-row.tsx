import type { ReactNode } from "react";

import { ccFamilyLabel, commercialUseAllowed, licenceLabel } from "@/lib/core/licence";
import { adapterLabel } from "@/lib/core/registry";
import type { SourceResult } from "@/types/source-result";

import { conditions } from "./licence-badge";
import { ResultThumb } from "./result-thumb";
import { VisitLink } from "./visit-link";

function year(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
}

function alsoFoundIn(result: SourceResult): string[] {
  const value = result.raw["alsoFoundIn"];
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * The licence pill. Tinted so reuse rights read at a glance, but the wording
 * beside it does the real work: colour alone never carries meaning, and an
 * unstated version has to say so rather than be inferred from a hue.
 */
function Licence({ result }: { result: SourceResult }) {
  const free = result.licence !== "UNKNOWN" && commercialUseAllowed(result.licence);
  const family = ccFamilyLabel(
    typeof result.raw["licenceLabel"] === "string" ? result.raw["licenceLabel"] : null,
  );
  const label =
    result.licence === "UNKNOWN" && family
      ? `${family} · version unstated`
      : licenceLabel(result.licence);
  const className = `lic ${free ? "free" : "restricted"}`;

  return result.licenceUrl ? (
    <a className={className} href={result.licenceUrl} target="_blank" rel="noreferrer noopener">
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  );
}

export function ResultRow({
  result,
  reasons,
  actions,
  visit,
  pinned,
}: {
  result: SourceResult;
  reasons?: readonly string[];
  actions?: ReactNode;
  /** Set on search results so opening one keeps it. */
  visit?: { query: string; categoryId: string };
  pinned?: boolean;
}) {
  const published = year(result.publishedAt);
  const corroborated = alsoFoundIn(result);
  const isFixture = result.raw["fixture"] === true;
  const visual = result.kind === "image" || result.kind === "artwork";

  const title = visit ? (
    <VisitLink query={visit.query} categoryId={visit.categoryId} result={result}>
      {result.title}
    </VisitLink>
  ) : (
    <a href={result.url} target="_blank" rel="noreferrer noopener">
      {result.title}
    </a>
  );

  const licence = (
    <div className="reslic">
      <Licence result={result} />
      <span>{conditions(result.licence)}</span>
      {result.attribution ? <span>· {result.attribution}</span> : null}
    </div>
  );

  const foot = (
    <div className={visual ? "tilefoot" : "resfoot"}>
      {pinned ? <span className="pinned">Pinned</span> : actions}
      {visual ? null : <span className="spacer" />}
      <a className="openout" href={result.url} target="_blank" rel="noreferrer noopener">
        Open source ↗
      </a>
    </div>
  );

  // Visual results are plates in a grid; everything else is a text card.
  if (visual) {
    return (
      <li className="tile">
        {result.thumbnailUrl ? <ResultThumb src={result.thumbnailUrl} /> : null}
        <div className="tilebody">
          <span className="resorigin">{adapterLabel(result.sourceId)}</span>
          <h3 className="restitle">{title}</h3>
          {licence}
          {foot}
        </div>
      </li>
    );
  }

  return (
    <li className="rescard">
      <div className="reshead">
        <span className="resorigin">
          {adapterLabel(result.sourceId)}
          {published ? <span className="year"> · {published}</span> : null}
          {corroborated.length > 0 ? (
            <span className="year"> · also in {corroborated.map(adapterLabel).join(", ")}</span>
          ) : null}
        </span>
        <span className="restags">
          {(reasons ?? []).map((reason) => (
            <span className="restag" key={reason}>
              {reason}
            </span>
          ))}
          {isFixture ? <span className="restag">fixture</span> : null}
        </span>
      </div>

      <h3 className="restitle">{title}</h3>
      {licence}
      {result.snippet ? <p className="ressnippet">{result.snippet}</p> : null}
      {foot}
    </li>
  );
}

export default ResultRow;
