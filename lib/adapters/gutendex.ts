import { getJson, noteFailure, qs } from "@/lib/core/http";
import { makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult } from "@/types/source-result";

const SOURCE_ID = "gutendex";
// Gutendex publishes no quota; 300ms apart keeps a single demo well clear.
const MIN_INTERVAL_MS = 300;
const MAX_RESULTS = 20;

interface Book {
  readonly id?: number;
  readonly title?: string;
  readonly authors?: readonly { readonly name?: string }[];
  readonly subjects?: readonly string[];
  readonly bookshelves?: readonly string[];
  readonly languages?: readonly string[];
  readonly download_count?: number;
  readonly copyright?: boolean | null;
  /** Machine-written by Gutendex, so it never becomes a snippet. */
  readonly summaries?: readonly string[];
  readonly formats?: Readonly<Record<string, string>>;
}

interface Response {
  readonly results?: readonly Book[];
}

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];
  try {
    const url = `https://gutendex.com/books?${qs({
      search: query,
      languages: "en",
      copyright: "false",
    })}`;

    const payload = await getJson<Response>(url, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
    });

    const out: SourceResult[] = [];
    for (const book of (payload.results ?? []).slice(0, MAX_RESULTS)) {
      if (book.id === undefined || !book.title) continue;
      // copyright:false filters to public-domain-in-the-US texts; anything
      // that slips through without the flag is not claimed as public domain.
      const publicDomain = book.copyright === false;

      const result = makeResult({
        sourceId: SOURCE_ID,
        sourceKey: String(book.id),
        title: book.title,
        url: `https://www.gutenberg.org/ebooks/${book.id}`,
        snippet: null,
        kind: "book",
        licence: publicDomain ? "CC-PDDC" : "UNKNOWN",
        licenceUrl: publicDomain ? "https://www.gutenberg.org/policy/license.html" : null,
        attribution:
          book.authors
            ?.map((a) => a.name)
            .filter((name): name is string => Boolean(name))
            .join(", ") ?? null,
        thumbnailUrl: book.formats?.["image/jpeg"] ?? null,
        publishedAt: null,
        raw: {
          subjects: book.subjects ?? [],
          bookshelves: book.bookshelves ?? [],
          downloadCount: book.download_count ?? 0,
          // Gutendex labels summaries "automatically generated", so they are
          // carried as provider metadata and never shown as a snippet.
          providerSummary: book.summaries?.[0] ?? null,
          plainTextUrl:
            book.formats?.["text/plain; charset=utf-8"] ??
            book.formats?.["text/plain"] ??
            null,
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

export const gutendexAdapter: Adapter = {
  sourceId: SOURCE_ID,
  label: "Project Gutenberg",
  homepage: "https://www.gutenberg.org",
  kinds: ["book"],
  search,
};
