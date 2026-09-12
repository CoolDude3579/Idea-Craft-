import { getJson, noteFailure, qs } from "@/lib/core/http";
import { isoDate, makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult } from "@/types/source-result";

const SOURCE_ID = "artic";
const LIMIT = 20;
// Art Institute asks for under 60 requests/minute; 1s apart is well clear.
const MIN_INTERVAL_MS = 1_000;

const FIELDS = [
  "id",
  "title",
  "artist_title",
  "image_id",
  "is_public_domain",
  "date_display",
  "date_end",
  "medium_display",
  "department_title",
  "classification_title",
].join(",");

interface Artwork {
  readonly id?: number;
  readonly title?: string | null;
  readonly artist_title?: string | null;
  readonly image_id?: string | null;
  readonly is_public_domain?: boolean;
  readonly date_display?: string | null;
  readonly date_end?: number | null;
  readonly medium_display?: string | null;
  readonly department_title?: string | null;
  readonly classification_title?: string | null;
}

interface Response {
  readonly data?: readonly Artwork[];
  readonly config?: { readonly iiif_url?: string };
}

const IIIF_FALLBACK = "https://www.artic.edu/iiif/2";

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];
  try {
    // `fields` works on the search endpoint, so this stays a single call —
    // no per-object fan-out.
    const url = `https://api.artic.edu/api/v1/artworks/search?${qs({
      q: query,
      limit: LIMIT,
      fields: FIELDS,
    })}`;

    const payload = await getJson<Response>(url, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
    });

    const iiif = payload.config?.iiif_url ?? IIIF_FALLBACK;

    const out: SourceResult[] = [];
    for (const artwork of payload.data ?? []) {
      if (artwork.id === undefined || !artwork.title) continue;

      // image_id is null for plenty of records, public domain included.
      const thumbnail = artwork.image_id
        ? `${iiif}/${artwork.image_id}/full/400,/0/default.jpg`
        : null;

      const result = makeResult({
        sourceId: SOURCE_ID,
        sourceKey: String(artwork.id),
        title: artwork.title,
        url: `https://www.artic.edu/artworks/${artwork.id}`,
        snippet: null,
        kind: "artwork",
        // Public-domain works carry no licence grant; everything else is
        // rights-restricted and reported as UNKNOWN rather than guessed.
        licence: artwork.is_public_domain ? "CC-PDDC" : "UNKNOWN",
        licenceUrl: artwork.is_public_domain
          ? "https://creativecommons.org/publicdomain/mark/1.0/"
          : null,
        attribution: artwork.artist_title ?? null,
        thumbnailUrl: thumbnail,
        publishedAt: isoDate(artwork.date_end ?? null),
        raw: {
          medium: artwork.medium_display ?? null,
          department: artwork.department_title ?? null,
          classification: artwork.classification_title ?? null,
          objectDate: artwork.date_display ?? null,
        },
      });
      if (result) out.push(result);
    }
    return out;
  } catch (error) {
    noteFailure(SOURCE_ID, error);
    console.error(`[${SOURCE_ID}] ${(error as Error).message}`);
    return [];
  }
}

export const articAdapter: Adapter = {
  sourceId: SOURCE_ID,
  label: "Art Institute of Chicago",
  homepage: "https://www.artic.edu/collection",
  kinds: ["artwork"],
  search,
};
