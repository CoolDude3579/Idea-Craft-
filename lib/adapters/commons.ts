import { getJson, noteFailure, qs } from "@/lib/core/http";
import { toSpdx } from "@/lib/core/licence";
import { isoDate, makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult } from "@/types/source-result";

const SOURCE_ID = "commons";
const LIMIT = 20;
// Wikimedia asks for a real user agent and serial requests; 200ms apart.
const MIN_INTERVAL_MS = 200;

interface MetaValue {
  readonly value?: string | number | null;
}

interface ImageInfo {
  readonly url?: string;
  readonly descriptionurl?: string;
  readonly thumburl?: string;
  readonly extmetadata?: Readonly<Record<string, MetaValue>>;
}

interface Page {
  readonly pageid?: number;
  readonly title?: string;
  readonly imageinfo?: readonly ImageInfo[];
}

interface Response {
  readonly query?: { readonly pages?: readonly Page[] };
}

/** Commons stores "cc-by-sa-4.0", "cc0", "pd" and similar in extmetadata. */
function licenceFrom(code: string | null): { slug: string | null; version: string | null } {
  if (!code) return { slug: null, version: null };
  const value = code.trim().toLowerCase();
  if (value.startsWith("cc0")) return { slug: "cc0", version: null };
  if (value === "pd" || value.startsWith("pd-")) {
    return { slug: "publicdomain", version: null };
  }
  const match = /^cc-(by(?:-nc)?(?:-sa|-nd)?)-(\d\.\d)$/.exec(value);
  if (!match) return { slug: null, version: null };
  return { slug: match[1] ?? null, version: match[2] ?? null };
}

function meta(info: ImageInfo, key: string): string | null {
  const value = info.extmetadata?.[key]?.value;
  return value === null || value === undefined ? null : String(value);
}

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://commons.wikimedia.org/w/api.php?${qs({
      action: "query",
      format: "json",
      formatversion: 2,
      generator: "search",
      gsrsearch: query,
      gsrnamespace: 6,
      gsrlimit: LIMIT,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: 320,
      iiextmetadatafilter:
        "License|LicenseShortName|LicenseUrl|Artist|ImageDescription|DateTimeOriginal",
    })}`;

    const payload = await getJson<Response>(url, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
    });

    const out: SourceResult[] = [];
    for (const page of payload.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      const link = info?.descriptionurl;
      if (!info || !link) continue;

      const { slug, version } = licenceFrom(meta(info, "License"));

      const result = makeResult({
        sourceId: SOURCE_ID,
        sourceKey: String(page.pageid ?? link),
        title: (page.title ?? "").replace(/^File:/, ""),
        url: link,
        snippet: meta(info, "ImageDescription"),
        kind: "image",
        licence: toSpdx(slug, version),
        licenceUrl: meta(info, "LicenseUrl"),
        attribution: meta(info, "Artist"),
        thumbnailUrl: info.thumburl ?? null,
        publishedAt: isoDate(meta(info, "DateTimeOriginal")),
        raw: {
          licenceLabel: meta(info, "LicenseShortName"),
          fileUrl: info.url ?? null,
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

export const commonsAdapter: Adapter = {
  sourceId: SOURCE_ID,
  label: "Wikimedia Commons",
  homepage: "https://commons.wikimedia.org",
  kinds: ["image"],
  search,
};
