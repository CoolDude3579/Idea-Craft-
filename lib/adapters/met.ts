import { getJson, noteFailure, qs } from "@/lib/core/http";
import { isoDate, makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult } from "@/types/source-result";

const SOURCE_ID = "met";
// The Met asks for no more than 80 requests/second; search + 12 object
// look-ups at 80ms apart stays far below that and keeps the demo snappy.
const MIN_INTERVAL_MS = 80;
const MAX_OBJECTS = 12;

interface SearchResponse {
  readonly objectIDs?: readonly number[] | null;
}

interface Artwork {
  readonly objectID?: number;
  readonly title?: string | null;
  readonly objectURL?: string | null;
  readonly primaryImageSmall?: string | null;
  readonly artistDisplayName?: string | null;
  readonly objectDate?: string | null;
  readonly objectBeginDate?: number | null;
  readonly medium?: string | null;
  readonly department?: string | null;
  readonly classification?: string | null;
  readonly isPublicDomain?: boolean;
}

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];
  try {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?${qs({
      q: query,
      hasImages: "true",
      isPublicDomain: "true",
    })}`;

    const found = await getJson<SearchResponse>(searchUrl, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
    });

    const ids = (found.objectIDs ?? []).slice(0, MAX_OBJECTS);
    const artworks = await Promise.all(
      ids.map(async (id) => {
        try {
          return await getJson<Artwork>(
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
            { sourceId: SOURCE_ID, minIntervalMs: MIN_INTERVAL_MS },
          );
        } catch (error) {
          console.error(`[${SOURCE_ID}] object ${id}: ${(error as Error).message}`);
          return null;
        }
      }),
    );

    const out: SourceResult[] = [];
    for (const artwork of artworks) {
      if (!artwork?.objectURL || !artwork.title) continue;

      const result = makeResult({
        sourceId: SOURCE_ID,
        sourceKey: String(artwork.objectID ?? artwork.objectURL),
        title: artwork.title,
        url: artwork.objectURL,
        snippet: null,
        kind: "artwork",
        // The Met releases public-domain images as CC0; everything else is
        // rights-restricted, so it is reported as UNKNOWN rather than guessed.
        licence: artwork.isPublicDomain ? "CC0-1.0" : "UNKNOWN",
        licenceUrl: artwork.isPublicDomain
          ? "https://creativecommons.org/publicdomain/zero/1.0/"
          : null,
        attribution: artwork.artistDisplayName ?? null,
        thumbnailUrl: artwork.primaryImageSmall ?? null,
        publishedAt: isoDate(artwork.objectBeginDate ?? null),
        raw: {
          medium: artwork.medium ?? null,
          department: artwork.department ?? null,
          classification: artwork.classification ?? null,
          objectDate: artwork.objectDate ?? null,
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

export const metAdapter: Adapter = {
  sourceId: SOURCE_ID,
  label: "The Met Collection",
  homepage: "https://www.metmuseum.org/art/collection",
  kinds: ["artwork"],
  search,
};
