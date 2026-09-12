import type { SourceResult } from "@/types/source-result";

import { reuseScore } from "./licence";
import { canonicalUrl } from "./normalise";

function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .slice(0, 12)
    .join(" ");
}

function doi(result: SourceResult): string | null {
  const raw = result.raw["doi"];
  if (typeof raw !== "string") return null;
  const match = /10\.\d{4,9}\/\S+/.exec(raw.toLowerCase());
  return match ? match[0] : null;
}

/** Keys that make two results the same thing, strongest first. */
function keysFor(result: SourceResult): string[] {
  const keys = [`url:${canonicalUrl(result.url)}`];
  const id = doi(result);
  if (id) keys.unshift(`doi:${id}`);
  const fingerprint = titleFingerprint(result.title);
  if (fingerprint.length > 12) keys.push(`title:${result.kind}:${fingerprint}`);
  return keys;
}

/**
 * Collapses duplicates across sources. The survivor is the copy with the
 * freer licence, then the one with a provider snippet; the losers' source
 * ids are recorded in `raw.alsoFoundIn` so the UI can credit them.
 */
export function dedupe(results: readonly SourceResult[]): SourceResult[] {
  const winners = new Map<string, SourceResult>();
  const alias = new Map<string, string>();

  for (const candidate of results) {
    const keys = keysFor(candidate);
    const existingKey = keys.map((k) => alias.get(k)).find((k) => k !== undefined);

    if (existingKey === undefined) {
      const primary = keys[0] as string;
      winners.set(primary, candidate);
      for (const key of keys) alias.set(key, primary);
      continue;
    }

    const incumbent = winners.get(existingKey);
    if (!incumbent) continue;

    const better = preferred(incumbent, candidate);
    const loser = better === incumbent ? candidate : incumbent;
    const merged = withAlsoFoundIn(better, loser.sourceId);
    winners.set(existingKey, merged);
    for (const key of keys) if (!alias.has(key)) alias.set(key, existingKey);
  }

  return [...winners.values()];
}

function preferred(a: SourceResult, b: SourceResult): SourceResult {
  const byLicence = reuseScore(b.licence) - reuseScore(a.licence);
  if (byLicence > 0.001) return b;
  if (byLicence < -0.001) return a;
  if (!a.snippet && b.snippet) return b;
  if (!a.thumbnailUrl && b.thumbnailUrl) return b;
  return a;
}

function withAlsoFoundIn(result: SourceResult, sourceId: string): SourceResult {
  if (sourceId === result.sourceId) return result;
  const previous = result.raw["alsoFoundIn"];
  const list = Array.isArray(previous) ? (previous as string[]) : [];
  if (list.includes(sourceId)) return result;
  return Object.freeze({
    ...result,
    raw: Object.freeze({ ...result.raw, alsoFoundIn: [...list, sourceId] }),
  });
}
