import { getJson, qs } from "@/lib/core/http";
import { keywords } from "@/lib/core/keywords";

const SOURCE_ID = "datamuse";
// No key, generous limits; 150ms apart covers the three calls we make.
const MIN_INTERVAL_MS = 150;
const MAX = 24;

export type PhraseKind = "related" | "rhyme" | "modifier";

export interface Phrase {
  readonly word: string;
  readonly score: number;
  readonly partsOfSpeech: readonly string[];
}

export interface PhraseSet {
  readonly kind: PhraseKind;
  readonly label: string;
  readonly seed: string;
  readonly phrases: readonly Phrase[];
}

interface Row {
  readonly word?: string;
  readonly score?: number;
  readonly tags?: readonly string[];
}

const POS = new Set(["n", "v", "adj", "adv"]);

function toPhrase(row: Row): Phrase | null {
  if (!row.word) return null;
  return {
    word: row.word,
    score: row.score ?? 0,
    partsOfSpeech: (row.tags ?? []).filter((tag) => POS.has(tag)),
  };
}

async function fetchSet(
  kind: PhraseKind,
  label: string,
  seed: string,
  params: Record<string, string | number>,
): Promise<PhraseSet> {
  try {
    const rows = await getJson<readonly Row[]>(
      `https://api.datamuse.com/words?${qs({ ...params, max: MAX, md: "p" })}`,
      { sourceId: SOURCE_ID, minIntervalMs: MIN_INTERVAL_MS },
    );
    const phrases = rows
      .map(toPhrase)
      .filter((phrase): phrase is Phrase => phrase !== null);
    return { kind, label, seed, phrases };
  } catch (error) {
    console.error(`[${SOURCE_ID}] ${(error as Error).message}`);
    return { kind, label, seed, phrases: [] };
  }
}

/**
 * Words, not documents: these never become SourceResults and are never
 * pinned, ranked or licence-tagged. Datamuse output is not a source.
 */
export async function phrasesFor(ideaText: string): Promise<PhraseSet[]> {
  const terms = keywords(ideaText, 4);
  const seed = terms.join(" ") || ideaText.trim();
  if (!seed) return [];

  const head = terms[0] ?? seed;

  const sets = await Promise.all([
    fetchSet("related", "Means something like", seed, { ml: seed }),
    fetchSet("modifier", `Words that describe "${head}"`, head, { rel_jjb: head }),
    fetchSet("rhyme", `Rhymes with "${head}"`, head, { rel_rhy: head }),
  ]);

  return sets.filter((set) => set.phrases.length > 0);
}

export const DATAMUSE_HOMEPAGE = "https://www.datamuse.com/api/";
