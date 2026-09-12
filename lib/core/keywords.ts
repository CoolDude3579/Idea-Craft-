const STOP = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","how","i","in",
  "into","is","it","its","my","of","on","or","our","that","the","their","them",
  "then","there","these","this","to","want","was","we","what","when","which",
  "who","will","with","would","you","your","about","make","making","create",
  "creating","idea","ideas","need","project","using","use",
]);

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    // Tokens of three or more, plus anything carrying a digit. The old
    // length > 2 floor silently dropped the "1" from "formula 1", so the
    // search ran on "formula" alone and returned infant formula and chemical
    // formulae. Model numbers and years are the whole query surprisingly often.
    .filter((t) => (t.length > 2 || /\d/.test(t)) && !STOP.has(t));
}

/**
 * Keywords in the order the user wrote them. Frequency still wins, but ties
 * break on first appearance rather than alphabetically: sorting "race car" to
 * "car race" throws away the phrase, and providers rank phrases.
 */
export function keywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let position = 0;
  for (const token of tokenise(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
    if (!firstSeen.has(token)) firstSeen.set(token, position++);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0])! - firstSeen.get(b[0])!)
    .slice(0, limit)
    .map(([token]) => token);
}

/**
 * Does a candidate word satisfy a query token? Whole words only, with a short
 * allowance for inflection.
 *
 * Substring matching is what made this search untrustworthy: the token "car"
 * hit "mediCARe", so a lung-cancer paper scored as a race-car result. A prefix
 * rule kills that (medicare does not start with "car") while keeping the
 * plural that a strict equality test would lose (cars does).
 */
function satisfies(queryToken: string, word: string): boolean {
  if (word === queryToken) return true;
  const [longer, shorter] =
    word.length >= queryToken.length ? [word, queryToken] : [queryToken, word];
  if (!longer.startsWith(shorter)) return false;
  // Short tokens get one character of slack ("car"/"cars"), longer ones three
  // ("campaign"/"campaigns"). More than that drifts to a different word:
  // "art" would otherwise reach "article".
  return longer.length - shorter.length <= (shorter.length <= 4 ? 1 : 3);
}

/** Fraction of query tokens present in the candidate text, as whole words. */
export function overlap(queryTokens: readonly string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const words = new Set(tokenise(text));
  let hits = 0;
  for (const token of queryTokens) {
    for (const word of words) {
      if (satisfies(token, word)) {
        hits += 1;
        break;
      }
    }
  }
  return hits / queryTokens.length;
}

/** True when the query's words appear in order, adjacent, in the text. */
export function hasPhrase(queryTokens: readonly string[], text: string): boolean {
  if (queryTokens.length < 2) return false;
  const words = tokenise(text);
  for (let i = 0; i + queryTokens.length <= words.length; i++) {
    let all = true;
    for (let j = 0; j < queryTokens.length; j++) {
      if (!satisfies(queryTokens[j]!, words[i + j]!)) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

export function cacheKey(parts: readonly string[]): string {
  return parts.map((p) => p.trim().toLowerCase()).join("::");
}
