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
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function keywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenise(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

/** Fraction of query keywords present in the candidate text. */
export function overlap(queryTokens: readonly string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) if (haystack.includes(token)) hits += 1;
  return hits / queryTokens.length;
}

export function cacheKey(parts: readonly string[]): string {
  return parts.map((p) => p.trim().toLowerCase()).join("::");
}
