/**
 * Source id to display label, with no imports.
 *
 * registry.ts reads the label off each adapter, which is right — but importing
 * registry pulls in every adapter and the node-only HTTP layer with them, so a
 * client component cannot use it. The loading skeleton needs to name the
 * sources it is waiting on before any server response exists, so the map lives
 * here and registry falls back to it: one source of truth either way.
 */
export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  openalex: "OpenAlex",
  europepmc: "Europe PMC",
  openverse: "Openverse",
  commons: "Wikimedia Commons",
  artic: "Art Institute of Chicago",
  met: "The Met Collection",
  gutendex: "Project Gutenberg",
  datamuse: "Datamuse",
};

export function sourceLabel(sourceId: string): string {
  return SOURCE_LABELS[sourceId] ?? sourceId;
}
