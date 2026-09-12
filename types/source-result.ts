export const CONTRACT = "contract-v1" as const;

export type Contract = typeof CONTRACT;

/**
 * Real SPDX identifiers. Versions matter: Openverse serves mostly Flickr
 * CC 2.0, so collapsing versions would misreport the licence on a surface
 * whose whole point is reuse rights.
 */
export const SPDX = [
  "CC0-1.0",
  "CC-PDDC",
  "CC-BY-2.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-2.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-2.0",
  "CC-BY-NC-3.0",
  "CC-BY-NC-4.0",
  "CC-BY-ND-2.0",
  "CC-BY-ND-3.0",
  "CC-BY-ND-4.0",
  "CC-BY-NC-SA-2.0",
  "CC-BY-NC-SA-3.0",
  "CC-BY-NC-SA-4.0",
  "CC-BY-NC-ND-2.0",
  "CC-BY-NC-ND-3.0",
  "CC-BY-NC-ND-4.0",
  "MIT",
  "Apache-2.0",
  "UNKNOWN",
] as const;

export type Spdx = (typeof SPDX)[number];

export type ResultKind =
  | "paper"
  | "article"
  | "image"
  | "artwork"
  | "book"
  | "dataset"
  | "code";

/** contract-v1. Adapters return these and nothing else. */
export interface SourceResult {
  readonly contract: Contract;
  readonly sourceId: string;
  /** Stable within sourceId. */
  readonly sourceKey: string;
  readonly title: string;
  /** Outbound deep link to the provider. We never host content. */
  readonly url: string;
  /** Provider-supplied text only. Never generated or summarised. */
  readonly snippet: string | null;
  readonly kind: ResultKind;
  readonly licence: Spdx;
  readonly licenceUrl: string | null;
  readonly attribution: string | null;
  readonly thumbnailUrl: string | null;
  /** ISO-8601 date or null. */
  readonly publishedAt: string | null;
  /** Source-specific fields live here. Never add top-level fields. */
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface Adapter {
  readonly sourceId: string;
  readonly label: string;
  readonly homepage: string;
  readonly kinds: readonly ResultKind[];
  search(query: string): Promise<SourceResult[]>;
}

export function isSpdx(value: string): value is Spdx {
  return (SPDX as readonly string[]).includes(value);
}
