import type { ReactNode } from "react";

import { ccFamilyLabel } from "@/lib/core/licence";
import { adapterLabel } from "@/lib/core/registry";
import type { SourceResult } from "@/types/source-result";

import { LicenceBadge, conditions } from "./licence-badge";
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

export function ResultRow({
  result,
  reasons,
  actions,
  visit,
}: {
  result: SourceResult;
  reasons?: readonly string[];
  actions?: ReactNode;
  /** Set on search results so opening one keeps it. Omitted where the row is
      already pinned, which is every row on the idea page. */
  visit?: { query: string; categoryId: string };
}) {
  const published = year(result.publishedAt);
  const corroborated = alsoFoundIn(result);
  const isFixture = result.raw["fixture"] === true;

  return (
    <li className={result.thumbnailUrl ? "result" : "result no-thumb"}>
      {result.thumbnailUrl ? (
        // Provider thumbnail, hotlinked: we hold no copy of the media.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.thumbnailUrl} alt="" loading="lazy" />
      ) : null}
      <div>
        <h3>
          {visit ? (
            <VisitLink
              query={visit.query}
              categoryId={visit.categoryId}
              result={result}
            >
              {result.title}
            </VisitLink>
          ) : (
            <a href={result.url} target="_blank" rel="noreferrer noopener">
              {result.title}
            </a>
          )}
        </h3>
        <div className="meta">
          <LicenceBadge
            licence={result.licence}
            licenceUrl={result.licenceUrl}
            providerFamily={ccFamilyLabel(
              typeof result.raw["licenceLabel"] === "string"
                ? result.raw["licenceLabel"]
                : null,
            )}
          />
          <span>{conditions(result.licence)}</span>
          <span>·</span>
          <span>{adapterLabel(result.sourceId)}</span>
          {published ? <span>· {published}</span> : null}
          {result.attribution ? <span>· {result.attribution}</span> : null}
          {corroborated.length > 0 ? (
            <span>· also in {corroborated.map(adapterLabel).join(", ")}</span>
          ) : null}
          {reasons && reasons.length > 0 ? <span>· {reasons.join(", ")}</span> : null}
          {isFixture ? <span className="pill down">fixture</span> : null}
        </div>
        {result.snippet ? <p className="snippet">{result.snippet}</p> : null}
        {actions ? <div className="rowactions">{actions}</div> : null}
      </div>
    </li>
  );
}
