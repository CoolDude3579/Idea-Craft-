import type { SourceResult } from "@/types/source-result";

import { hasPhrase, keywords, overlap } from "./keywords";
import { reuseScore } from "./licence";

export interface Scored {
  readonly result: SourceResult;
  readonly score: number;
  readonly reasons: readonly string[];
}

/**
 * Relevance decides the order; licence and recency only modulate it. The old
 * additive weighting gave every result ~0.3 for free from licence and recency
 * alone, so an off-topic CC0 paper outscored a relevant one — the multiplier
 * shape makes that impossible: nothing irrelevant can be lifted by being
 * well-licensed.
 */
const TITLE_SHARE = 0.6;
const BODY_SHARE = 0.4;
const PHRASE_BONUS = 0.15;
const LICENCE_LIFT = 0.15;
const RECENCY_LIFT = 0.1;

/**
 * Below this a result is off-topic rather than weakly matched. A two-token
 * query matching one token in the snippet and nothing in the title lands at
 * 0.2, which is where "CAR T-cell therapy" sits for "race car".
 */
const FLOOR = 0.25;

/** Never strand the user with an empty page: a thin query keeps its best. */
const MIN_RESULTS = 8;

/** One provider may not own the page, but it may not be diluted either. */
const MAX_RUN = 3;

function recency(publishedAt: string | null): number {
  if (!publishedAt) return 0.35;
  const years = (Date.now() - Date.parse(publishedAt)) / 31_557_600_000;
  if (Number.isNaN(years)) return 0.35;
  if (years <= 0) return 1;
  return 1 / (1 + years / 8);
}

/** Scored plus the relevance the floor is applied to, kept internal. */
interface Judged extends Scored {
  readonly relevance: number;
}

function score(result: SourceResult, queryTokens: readonly string[]): Judged {
  const titleHit = overlap(queryTokens, result.title);
  const bodyHit = result.snippet ? overlap(queryTokens, result.snippet) : 0;
  const phrase = hasPhrase(queryTokens, result.title);

  // Split the weight only when there is a body to weigh. Otherwise a provider
  // with terse metadata is capped at TITLE_SHARE and can never outrank one that
  // ships abstracts, however well its title matches — Openverse lost to
  // Wikimedia Commons on every query for exactly that reason.
  const base = result.snippet
    ? titleHit * TITLE_SHARE + bodyHit * BODY_SHARE
    : titleHit;

  const relevance = Math.min(1, base + (phrase ? PHRASE_BONUS : 0));

  const licenceHit = reuseScore(result.licence);
  const recencyHit = recency(result.publishedAt);

  const reasons: string[] = [];
  if (phrase) reasons.push("exact phrase");
  else if (titleHit >= 0.5) reasons.push("title match");
  if (licenceHit >= 0.85) reasons.push("freely reusable");
  if (Array.isArray(result.raw["alsoFoundIn"])) reasons.push("corroborated");

  const lift =
    1 -
    LICENCE_LIFT -
    RECENCY_LIFT +
    licenceHit * LICENCE_LIFT +
    recencyHit * RECENCY_LIFT;

  return { result, score: relevance * lift, reasons, relevance };
}

/**
 * Caps how many results in a row may come from one provider without ever
 * putting a weaker result above a stronger one by more than that cap. The old
 * strict round-robin interleave was the single worst thing in this pipeline:
 * it alternated providers regardless of score, so a 0.55 result sat above a
 * 0.73 one on every other line.
 */
function diversify(ordered: readonly Scored[], limit: number): Scored[] {
  const pool = [...ordered];
  const out: Scored[] = [];
  let lastSource = "";
  let run = 0;

  while (out.length < limit && pool.length > 0) {
    let index = 0;
    if (run >= MAX_RUN) {
      const alternative = pool.findIndex(
        (item) => item.result.sourceId !== lastSource,
      );
      if (alternative !== -1) index = alternative;
    }
    const [next] = pool.splice(index, 1);
    if (!next) break;

    if (next.result.sourceId === lastSource) run += 1;
    else {
      lastSource = next.result.sourceId;
      run = 1;
    }
    out.push(next);
  }
  return out;
}

/**
 * Scores every result against the user's own keywords, drops what is off-topic,
 * then spreads the survivors across providers without inverting the ranking.
 *
 * `terms` is the user's wording; `query` may carry the subcategory's steering
 * modifiers, which belong in the provider request but not in the relevance
 * test — a poster is not less relevant for failing to contain the word
 * "poster".
 */
export function rerank(
  results: readonly SourceResult[],
  query: string,
  limit = 40,
  terms?: readonly string[],
): Scored[] {
  const queryTokens =
    terms && terms.length > 0 ? terms : keywords(query);

  const scored = results
    .map((result) => score(result, queryTokens))
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter((item) => item.relevance >= FLOOR);

  // Backfill rather than show an empty page: providers already filtered on
  // their side, so a sparse query's weak matches are better than nothing —
  // they just must not outrank real ones.
  const kept: Judged[] =
    relevant.length >= MIN_RESULTS
      ? relevant
      : [
          ...relevant,
          ...scored.filter((item) => item.relevance < FLOOR),
        ].slice(0, MIN_RESULTS);

  return diversify(kept, limit);
}
