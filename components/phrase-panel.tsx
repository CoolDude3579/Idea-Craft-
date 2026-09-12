import type { PhraseSet } from "@/lib/phrases/datamuse";

/**
 * Datamuse gives words, not documents. They are rendered as a panel, never
 * as result cards: nothing here is a source, licensable or pinnable.
 */
export function PhrasePanel({ sets }: { sets: readonly PhraseSet[] }) {
  if (sets.length === 0) return null;

  return (
    <section className="section phrases">
      <h2>Phrase ideas</h2>
      <p className="tagline">
        Word suggestions from{" "}
        <a href="https://www.datamuse.com/api/" target="_blank" rel="noreferrer noopener">
          Datamuse
        </a>
        . Vocabulary, not sources — nothing here is licensed or pinnable.
      </p>
      {sets.map((set) => (
        <div key={`${set.kind}:${set.seed}`} className="phraseset">
          <h3>{set.label}</h3>
          <ul>
            {set.phrases.map((phrase) => (
              <li key={phrase.word} title={phrase.partsOfSpeech.join(", ")}>
                {phrase.word}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
