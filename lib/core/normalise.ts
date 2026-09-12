import { CONTRACT, type ResultKind, type SourceResult, type Spdx } from "@/types/source-result";

const TRACKING = /^(utm_|gclid|fbclid|ref|referrer|mc_)/i;

export function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.host = parsed.host.toLowerCase().replace(/^www\./, "");
    parsed.protocol = "https:";
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING.test(key)) parsed.searchParams.delete(key);
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Only the inline formatting tags providers actually send. A blanket
 * /<[^>]*>/ would eat the middle of a title like "p < 0.05 in men > 40",
 * which is a worse failure than leaving a stray tag in.
 */
const INLINE_TAG = /<\/?(?:b|i|em|strong|sub|sup|u|br|span)\s*\/?>/gi;

export function stripTags(text: string): string {
  return collapseWhitespace(text.replace(INLINE_TAG, " "));
}

/**
 * Europe PMC sends markup HTML-escaped, so a title arrives as
 * "&lt;b&gt;Protective effects...&lt;/b&gt;" and stripTags finds no tags to
 * strip — it rendered literally on the page and in the export. Entities are
 * decoded first, then the tags they reveal are stripped.
 *
 * &amp; is decoded last so "&amp;lt;" ends up as the text "&lt;" rather than
 * being unescaped twice into a tag that was never there.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0*39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*8217;|&rsquo;/gi, "\u2019")
    .replace(/&amp;/gi, "&");
}

/** Provider prose as the user should read it: entities decoded, formatting
    tags dropped, whitespace collapsed. */
export function cleanText(text: string): string {
  return stripTags(decodeEntities(text));
}

export function isoDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value, 0, 1) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface DraftResult {
  sourceId: string;
  sourceKey: string;
  title: string;
  url: string;
  snippet?: string | null;
  kind: ResultKind;
  licence: Spdx;
  licenceUrl?: string | null;
  attribution?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  raw: Record<string, unknown>;
}

const SNIPPET_MAX = 400;

/** The only constructor for contract-v1 results. Adapters go through it. */
export function makeResult(draft: DraftResult): SourceResult | null {
  const title = cleanText(draft.title);
  const url = canonicalUrl(draft.url);
  if (!title || !url.startsWith("https://")) return null;

  const snippet = draft.snippet ? cleanText(draft.snippet) : null;

  return Object.freeze({
    contract: CONTRACT,
    sourceId: draft.sourceId,
    sourceKey: draft.sourceKey,
    title,
    url,
    snippet: snippet && snippet.length > 0 ? snippet.slice(0, SNIPPET_MAX) : null,
    kind: draft.kind,
    licence: draft.licence,
    licenceUrl: draft.licenceUrl ?? null,
    attribution: draft.attribution ? cleanText(draft.attribution) : null,
    thumbnailUrl: draft.thumbnailUrl ?? null,
    publishedAt: draft.publishedAt ?? null,
    raw: Object.freeze(draft.raw),
  });
}
