import { getJson, noteFailure, qs } from "@/lib/core/http";
import { toSpdx } from "@/lib/core/licence";
import { isoDate, makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult } from "@/types/source-result";

const SOURCE_ID = "openalex";
const PER_PAGE = 20;
// OpenAlex: 10 req/s, 100k/day for the polite pool. 120ms keeps us inside it.
const MIN_INTERVAL_MS = 120;

interface Location {
  readonly license?: string | null;
  readonly license_id?: string | null;
  readonly landing_page_url?: string | null;
  readonly pdf_url?: string | null;
}

interface Work {
  readonly id?: string;
  readonly doi?: string | null;
  readonly title?: string | null;
  readonly display_name?: string | null;
  readonly publication_year?: number | null;
  readonly publication_date?: string | null;
  readonly cited_by_count?: number;
  readonly type?: string | null;
  readonly open_access?: { readonly oa_url?: string | null };
  readonly best_oa_location?: Location | null;
  readonly primary_location?: Location | null;
  readonly authorships?: readonly { readonly author?: { readonly display_name?: string } }[];
  readonly abstract_inverted_index?: Readonly<Record<string, readonly number[]>> | null;
}

interface Response {
  readonly results?: readonly Work[];
}

/**
 * OpenAlex ships abstracts as an inverted index, not prose. Rebuilding the
 * provider's own word order is reconstruction, not summarisation.
 */
function abstractOf(index: Work["abstract_inverted_index"]): string | null {
  if (!index) return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) slots[position] = word;
  }
  const text = slots.filter((word) => word !== undefined).join(" ");
  return text.length > 0 ? text : null;
}

/** Verified: often null even for gold OA, and never version-qualified. */
function licenceOf(work: Work): string | null {
  const slug =
    work.best_oa_location?.license ??
    work.primary_location?.license ??
    work.best_oa_location?.license_id ??
    work.primary_location?.license_id ??
    null;
  // license_id arrives as "licenses/cc-by".
  return slug ? slug.replace(/^licenses\//, "") : null;
}

function linkOf(work: Work): string | null {
  return (
    work.best_oa_location?.landing_page_url ??
    work.open_access?.oa_url ??
    work.best_oa_location?.pdf_url ??
    (work.doi ? work.doi : null) ??
    work.id ??
    null
  );
}

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];
  try {
    const mailto = process.env.OPENALEX_MAILTO;
    const url = `https://api.openalex.org/works?${qs({
      search: query,
      per_page: PER_PAGE,
      filter: "is_oa:true",
      sort: "relevance_score:desc",
      mailto,
    })}`;

    const payload = await getJson<Response>(url, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
    });

    const out: SourceResult[] = [];
    for (const work of payload.results ?? []) {
      const title = work.display_name ?? work.title ?? "";
      const link = linkOf(work);
      if (!link) continue;

      const result = makeResult({
        sourceId: SOURCE_ID,
        sourceKey: work.id ?? link,
        title,
        url: link,
        snippet: abstractOf(work.abstract_inverted_index),
        kind: "paper",
        licence: toSpdx(licenceOf(work)),
        licenceUrl: null,
        attribution:
          work.authorships
            ?.map((a) => a.author?.display_name)
            .filter((name): name is string => Boolean(name))
            .slice(0, 3)
            .join(", ") ?? null,
        publishedAt: isoDate(work.publication_date ?? work.publication_year ?? null),
        raw: {
          doi: work.doi ?? null,
          citedByCount: work.cited_by_count ?? 0,
          workType: work.type ?? null,
          licenceLabel: licenceOf(work),
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

export const openalexAdapter: Adapter = {
  sourceId: SOURCE_ID,
  label: "OpenAlex",
  homepage: "https://openalex.org",
  kinds: ["paper"],
  search,
};
