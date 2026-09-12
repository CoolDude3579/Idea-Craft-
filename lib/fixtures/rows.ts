import type { ResultKind, Spdx } from "@/types/source-result";

export interface FixtureRow {
  readonly sourceId: string;
  readonly sourceKey: string;
  readonly title: string;
  readonly url: string;
  readonly snippet?: string;
  readonly kind: ResultKind;
  readonly licence: Spdx;
  readonly licenceUrl?: string;
  readonly attribution?: string;
  readonly thumbnailUrl?: string;
  readonly publishedAt?: string;
  readonly tags: readonly string[];
  readonly raw?: Record<string, unknown>;
}

/**
 * Placeholder records for offline demos, not captured provider content:
 * every url points at the provider's own search page so the outbound link
 * still works, and `fixture: true` makes the UI label them.
 *
 * Two pairs share a doi on purpose (10.5555/fixture-screening and
 * 10.5555/fixture-poster-recall) so the dedupe path is visible offline.
 */
export const FIXTURE_ROWS: readonly FixtureRow[] = [
  {
    sourceId: "openalex",
    sourceKey: "fixture-oa-1",
    title: "Community screening uptake after a local cancer awareness campaign",
    url: "https://openalex.org/works?search=cancer%20awareness%20campaign%20screening",
    snippet:
      "Placeholder abstract for offline demos. Describes screening uptake before and after a community awareness campaign.",
    kind: "paper",
    licence: "CC-BY-4.0",
    attribution: "Placeholder, A.; Placeholder, B.",
    publishedAt: "2024-03-01T00:00:00.000Z",
    tags: ["cancer", "awareness", "campaign", "screening", "health", "community"],
    raw: { doi: "10.5555/fixture-screening", citedByCount: 48 },
  },
  {
    sourceId: "europepmc",
    sourceKey: "fixture-epmc-1",
    title: "Community screening uptake after a local cancer awareness campaign",
    url: "https://europepmc.org/search?query=cancer%20awareness%20campaign",
    snippet:
      "Placeholder abstract for offline demos. Same record as the OpenAlex copy, kept here to exercise cross-source dedupe.",
    kind: "article",
    licence: "CC-BY-SA-4.0",
    attribution: "Placeholder, A.; Placeholder, B.",
    publishedAt: "2024-03-01T00:00:00.000Z",
    tags: ["cancer", "awareness", "campaign", "screening", "health"],
    raw: { doi: "10.5555/fixture-screening", journal: "Placeholder Public Health" },
  },
  {
    sourceId: "openalex",
    sourceKey: "fixture-oa-2",
    title: "Systematic review of message framing in public health campaigns",
    url: "https://openalex.org/works?search=message%20framing%20public%20health%20campaign",
    snippet:
      "Placeholder abstract for offline demos. Reviews framing effects across public health campaign evaluations.",
    kind: "paper",
    licence: "CC0-1.0",
    attribution: "Placeholder, C.",
    publishedAt: "2023-09-15T00:00:00.000Z",
    tags: ["campaign", "awareness", "framing", "review", "health", "slogan"],
    raw: { doi: "10.5555/fixture-framing", citedByCount: 210 },
  },
  {
    sourceId: "openalex",
    sourceKey: "fixture-oa-3",
    title: "A cohort dataset of breast cancer screening invitations and outcomes",
    url: "https://openalex.org/works?search=breast%20cancer%20screening%20cohort%20dataset",
    snippet:
      "Placeholder abstract for offline demos. Documents a cohort dataset of screening invitations and follow-up outcomes.",
    kind: "dataset",
    licence: "CC-BY-4.0",
    publishedAt: "2025-01-20T00:00:00.000Z",
    tags: ["cancer", "breast", "dataset", "cohort", "screening"],
    raw: { doi: "10.5555/fixture-cohort", citedByCount: 12 },
  },
  {
    sourceId: "europepmc",
    sourceKey: "fixture-epmc-2",
    title: "Poster recall in a student-led cancer awareness week",
    url: "https://europepmc.org/search?query=cancer%20awareness%20poster%20recall",
    snippet:
      "Placeholder abstract for offline demos. Measures recall of poster designs used during an awareness week.",
    kind: "article",
    licence: "CC-BY-4.0",
    attribution: "Placeholder, D.",
    publishedAt: "2025-05-02T00:00:00.000Z",
    tags: ["cancer", "awareness", "poster", "campaign", "recall", "design"],
    raw: { doi: "10.5555/fixture-poster-recall", journal: "Placeholder Health Promotion" },
  },
  {
    sourceId: "europepmc",
    sourceKey: "fixture-epmc-3",
    title: "Poster recall in a student-led cancer awareness week (author accepted version)",
    url: "https://europepmc.org/search?query=poster%20recall%20awareness%20week",
    kind: "article",
    licence: "CC-BY-NC-4.0",
    attribution: "Placeholder, D.",
    publishedAt: "2025-05-02T00:00:00.000Z",
    tags: ["cancer", "awareness", "poster", "campaign", "recall"],
    raw: { doi: "10.5555/fixture-poster-recall" },
  },
  {
    sourceId: "openverse",
    sourceKey: "fixture-ov-1",
    title: "Awareness ribbon, flat vector illustration",
    url: "https://openverse.org/search/image?q=awareness%20ribbon",
    kind: "image",
    licence: "CC0-1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    attribution: "Placeholder contributor",
    publishedAt: "2024-11-04T00:00:00.000Z",
    tags: ["cancer", "awareness", "ribbon", "poster", "illustration", "campaign"],
    raw: { provider: "placeholder" },
  },
  {
    sourceId: "openverse",
    sourceKey: "fixture-ov-2",
    title: "Health campaign poster mock-up on a noticeboard",
    url: "https://openverse.org/search/image?q=health%20campaign%20poster",
    kind: "image",
    licence: "CC-BY-4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Placeholder contributor",
    publishedAt: "2023-06-30T00:00:00.000Z",
    tags: ["poster", "campaign", "awareness", "health", "design", "photograph"],
    raw: { provider: "placeholder" },
  },
  {
    sourceId: "openverse",
    sourceKey: "fixture-ov-3",
    title: "Hospital corridor, documentary photograph",
    url: "https://openverse.org/search/image?q=hospital%20corridor",
    kind: "image",
    licence: "CC-BY-NC-SA-4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    attribution: "Placeholder contributor",
    publishedAt: "2022-02-11T00:00:00.000Z",
    tags: ["health", "hospital", "photograph", "cancer", "campaign"],
    raw: { provider: "placeholder" },
  },
  {
    sourceId: "commons",
    sourceKey: "fixture-cm-1",
    title: "Pink awareness ribbon (SVG)",
    url: "https://commons.wikimedia.org/w/index.php?search=awareness+ribbon",
    snippet:
      "Placeholder file description for offline demos. Simple ribbon shape supplied as a scalable vector.",
    kind: "image",
    licence: "CC-BY-SA-4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution: "Placeholder uploader",
    publishedAt: "2021-10-01T00:00:00.000Z",
    tags: ["cancer", "awareness", "ribbon", "illustration", "poster", "diagram"],
    raw: { licenceLabel: "CC BY-SA 4.0" },
  },
  {
    sourceId: "commons",
    sourceKey: "fixture-cm-2",
    title: "Cell division diagram, labelled",
    url: "https://commons.wikimedia.org/w/index.php?search=cell+division+diagram",
    snippet:
      "Placeholder file description for offline demos. Labelled diagram of the stages of cell division.",
    kind: "image",
    licence: "CC0-1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    publishedAt: "2020-04-17T00:00:00.000Z",
    tags: ["cancer", "cell", "diagram", "illustration", "research"],
    raw: { licenceLabel: "CC0" },
  },
  {
    sourceId: "europepmc",
    sourceKey: "fixture-epmc-4",
    title: "Framing effects in cancer screening invitations: a randomised trial",
    url: "https://europepmc.org/search?query=framing%20cancer%20screening%20invitation",
    snippet:
      "Placeholder abstract for offline demos. Exercises the version-unstated licence badge.",
    kind: "article",
    // Europe PMC reports the family with no version; the badge says so.
    licence: "UNKNOWN",
    attribution: "Placeholder, E.",
    publishedAt: "2024-08-19T00:00:00.000Z",
    tags: ["cancer", "screening", "campaign", "awareness", "framing"],
    raw: { doi: "10.5555/fixture-framing-trial", licenceLabel: "cc by" },
  },
  {
    sourceId: "artic",
    sourceKey: "fixture-artic-1",
    title: "Public-health poster, colour lithograph",
    url: "https://www.artic.edu/collection?q=public%20health%20poster",
    kind: "artwork",
    licence: "CC-PDDC",
    licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
    attribution: "Unknown artist",
    publishedAt: "1918-01-01T00:00:00.000Z",
    tags: ["poster", "campaign", "health", "awareness", "artwork", "design"],
    raw: { medium: "Colour lithograph", department: "Prints and Drawings" },
  },
  {
    sourceId: "artic",
    sourceKey: "fixture-artic-2",
    title: "Rights-restricted campaign poster (no image release)",
    url: "https://www.artic.edu/collection?q=campaign%20poster",
    kind: "artwork",
    licence: "UNKNOWN",
    attribution: "Placeholder artist",
    publishedAt: "1962-01-01T00:00:00.000Z",
    tags: ["poster", "campaign", "awareness", "artwork"],
    raw: { medium: "Offset lithograph", department: "Prints and Drawings" },
  },
  {
    sourceId: "met",
    sourceKey: "fixture-met-1",
    title: "Public-domain lithograph, medical instruction plate",
    url: "https://www.metmuseum.org/art/collection/search?q=medical%20lithograph",
    kind: "artwork",
    licence: "CC0-1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    attribution: "Unknown artist",
    publishedAt: "1880-01-01T00:00:00.000Z",
    tags: ["medical", "artwork", "lithograph", "cancer", "health", "poster"],
    raw: { medium: "Lithograph", department: "Drawings and Prints" },
  },
  {
    sourceId: "gutendex",
    sourceKey: "fixture-gt-1",
    title: "A public-domain manual of persuasion and public address",
    url: "https://www.gutenberg.org/ebooks/search/?query=public+speaking+persuasion",
    kind: "book",
    licence: "CC-PDDC",
    licenceUrl: "https://www.gutenberg.org/policy/license.html",
    attribution: "Placeholder author",
    tags: ["slogan", "motto", "rhetoric", "campaign", "writing", "persuasion"],
    raw: { subjects: ["Rhetoric", "Public speaking"], downloadCount: 4100 },
  },
  {
    sourceId: "gutendex",
    sourceKey: "fixture-gt-2",
    title: "A public-domain treatise on hygiene and public health",
    url: "https://www.gutenberg.org/ebooks/search/?query=hygiene+public+health",
    kind: "book",
    licence: "CC-PDDC",
    licenceUrl: "https://www.gutenberg.org/policy/license.html",
    attribution: "Placeholder author",
    tags: ["health", "hygiene", "cancer", "writing", "reference", "terminology"],
    raw: { subjects: ["Hygiene", "Public health"], downloadCount: 980 },
  },
];
