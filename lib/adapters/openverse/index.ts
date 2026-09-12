import { USER_AGENT, getJson, noteFailure, qs } from "@/lib/core/http";
import { spdxFromUrl, toSpdx } from "@/lib/core/licence";
import { isoDate, makeResult } from "@/lib/core/normalise";
import type { Adapter, SourceResult, Spdx } from "@/types/source-result";

import type { OpenverseImage, OpenverseImageList, OpenverseToken } from "./types";

const SOURCE_ID = "openverse";
const LABEL = "Openverse";
const HOMEPAGE = "https://openverse.org";
const API = "https://api.openverse.org/v1";
const PAGE_SIZE = 20;

/**
 * Rate limit, read off the response headers rather than the docs:
 *   anonymous  X-RateLimit-Limit-anon_burst: 20/min  -> 0.33 req/sec
 *              X-RateLimit-Limit-anon_sustained: 200/day
 *   registered (client credentials) 100/min          -> 1.67 req/sec
 *
 * One search is one request, so the binding anonymous constraint is the
 * daily 200, not the interval. MIN_INTERVAL_MS below is set for the
 * registered pool (1.67/sec -> 600ms) and is comfortably under the
 * anonymous burst too; the token endpoint is called at most twice a day.
 */
const MIN_INTERVAL_MS = 600;
const TIMEOUT_MS = 15_000;

interface CachedToken {
  readonly value: string;
  readonly expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/**
 * Client-credentials token, when OPENVERSE_CLIENT_ID/SECRET are set. The
 * anonymous pool works without them, so a token failure degrades to
 * anonymous rather than failing the search.
 */
async function bearer(): Promise<string | null> {
  const clientId = process.env.OPENVERSE_CLIENT_ID;
  const clientSecret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  try {
    const response = await fetch(`${API}/auth_tokens/token/`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": USER_AGENT,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`token endpoint ${response.status}`);

    const payload = (await response.json()) as OpenverseToken;
    if (!payload.access_token) throw new Error("token endpoint returned no token");

    cachedToken = {
      value: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 43_200) * 1000,
    };
    return cachedToken.value;
  } catch (error) {
    console.error(`[${SOURCE_ID}] token: ${(error as Error).message}; using anonymous pool`);
    return null;
  }
}

/**
 * Openverse serves a lot of Flickr CC 2.0, so the version carries real
 * meaning. license + license_version is the primary signal; license_url is
 * the fallback. Neither usable means UNKNOWN, never a guessed 4.0.
 */
function licenceOf(image: OpenverseImage): Spdx {
  const fromSlug = toSpdx(image.license, image.license_version);
  if (fromSlug !== "UNKNOWN") return fromSlug;
  return spdxFromUrl(image.license_url);
}

function tagNames(image: OpenverseImage): string[] {
  return (image.tags ?? [])
    .map((tag) => tag.name)
    .filter((name): name is string => Boolean(name && name.trim()));
}

function toSourceResult(image: OpenverseImage): SourceResult | null {
  // foreign_landing_url is the provider's page; url is the raw media file.
  // We deep-link to the page and only hotlink the thumbnail.
  const link = image.foreign_landing_url ?? image.url;
  if (!link) return null;

  return makeResult({
    sourceId: SOURCE_ID,
    sourceKey: image.id ?? link,
    title: image.title ?? "Untitled image",
    url: link,
    // Openverse supplies no description field; nothing is invented here.
    snippet: null,
    kind: "image",
    licence: licenceOf(image),
    licenceUrl: image.license_url ?? null,
    // attribution is pre-built by Openverse; creator is the fallback.
    attribution: image.attribution ?? image.creator ?? null,
    thumbnailUrl: image.thumbnail ?? null,
    publishedAt: isoDate(image.indexed_on ?? null),
    raw: {
      provider: image.provider ?? null,
      providerSource: image.source ?? null,
      fileUrl: image.url ?? null,
      filetype: image.filetype ?? null,
      filesize: image.filesize ?? null,
      category: image.category ?? null,
      width: image.width ?? null,
      height: image.height ?? null,
      creator: image.creator ?? null,
      creatorUrl: image.creator_url ?? null,
      licenceLabel: image.license ?? null,
      licenceVersion: image.license_version ?? null,
      tags: tagNames(image),
    },
  });
}

async function search(query: string): Promise<SourceResult[]> {
  if (!query.trim()) return [];

  try {
    const access = await bearer();
    const url = `${API}/images/?${qs({
      q: query,
      page_size: PAGE_SIZE,
      mature: "false",
    })}`;

    const payload = await getJson<OpenverseImageList>(url, {
      sourceId: SOURCE_ID,
      minIntervalMs: MIN_INTERVAL_MS,
      timeoutMs: TIMEOUT_MS,
      headers: access ? { authorization: `Bearer ${access}` } : {},
    });

    const out: SourceResult[] = [];
    for (const image of payload.results ?? []) {
      const result = toSourceResult(image);
      if (result) out.push(result);
    }
    return out;
  } catch (error) {
    noteFailure(SOURCE_ID, error);
    console.error(`[${SOURCE_ID}] ${(error as Error).message}`);
    return [];
  }
}

export const adapter: Adapter = {
  sourceId: SOURCE_ID,
  label: LABEL,
  homepage: HOMEPAGE,
  kinds: ["image"],
  search,
};
