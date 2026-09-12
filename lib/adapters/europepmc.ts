import { getJson, noteFailure, qs } from "@/lib/core/http";
import { toSpdx } from "@/lib/core/licence";
import { isoDate, makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult } from "@/types/source-result";

const SOURCE_ID = "europepmc";
const PAGE_SIZE = 20;
// No key and no published quota; 250ms apart is the courtesy EBI asks for.
const MIN_INTERVAL_MS = 250;

interface FullTextUrl {
  readonly availability?: string;
  readonly availabilityCode?: string;
  readonly documentStyle?: string;
  readonly site?: string;
  readonly url?: string;
}

interface Result {
  readonly id?: string;
  readonly source?: string;
  readonly pmid?: string;
  readonly pmcid?: string;
  readonly doi?: string;
  readonly title?: string;
  readonly abstractText?: string;
  readonly authorString?: string;
  readonly firstPublicationDate?: string;
  readonly pubYear?: string;
  readonly isOpenAccess?: string;
  /** Verified present as lowercase, space-separated: "cc by", "cc by-nc". */
  readonly license?: string;
  readonly citedByCount?: number;
  readonly journalInfo?: { readonly journal?: { readonly title?: string } };
  readonly fullTextUrlList?: { readonly fullTextUrl?: readonly FullTextUrl[] };
}

interface Response {
  readonly hitCount?: number;
  readonly resultList?: { readonly result?: readonly Result[] };
}

/** Prefer an open-access full text, then the DOI, then the Europe PMC record. */
function linkOf(record: Result): string | null {
  const urls = record.fullTextUrlList?.fullTextUrl ?? [];
  const openHtml = urls.find(
    (u) => u.availabilityCode === "OA" && u.documentStyle === "html",
  );
  const anyOpen = urls.find((u) => u.availabilityCode === "OA");
  if (openHtml?.url) return openHtml.url;
  if (anyOpen?.url) return anyOpen.url;
  if (record.doi) return `https://doi.org/${record.doi}`;
  if (record.pmcid) return `https://europepmc.org/article/PMC/${record.pmcid}`;
  if (record.source && record.id) {
    return `https://europepmc.org/article/${record.source}/${record.id}`;
  }
  return null;
}

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${qs({
      query,
      format: "json",
      pageSize: PAGE_SIZE,
      resultType: "core",
    })}`;

    const payload = await getJson<Response>(url, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
    });

    const out: SourceResult[] = [];
    for (const record of payload.resultList?.result ?? []) {
      const link = linkOf(record);
      if (!link || !record.title) continue;

      const result = makeResult({
        sourceId: SOURCE_ID,
        sourceKey: `${record.source ?? "EPMC"}:${record.id ?? link}`,
        title: record.title,
        // abstractText carries provider markup (<h4>Background</h4>…);
        // makeResult strips tags, it does not rewrite the text.
        snippet: record.abstractText ?? null,
        url: link,
        kind: "article",
        licence: toSpdx(record.license),
        licenceUrl: null,
        attribution: record.authorString ?? null,
        publishedAt: isoDate(record.firstPublicationDate ?? record.pubYear ?? null),
        raw: {
          doi: record.doi ?? null,
          pmid: record.pmid ?? null,
          pmcid: record.pmcid ?? null,
          journal: record.journalInfo?.journal?.title ?? null,
          isOpenAccess: record.isOpenAccess === "Y",
          citedByCount: record.citedByCount ?? 0,
          licenceLabel: record.license ?? null,
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

export const europepmcAdapter: Adapter = {
  sourceId: SOURCE_ID,
  label: "Europe PMC",
  homepage: "https://europepmc.org",
  kinds: ["article"],
  search,
};
