import { keywords } from "./keywords";

export interface Subcategory {
  readonly id: string;
  readonly label: string;
  /** Terms appended to the user's keywords to steer the providers. */
  readonly modifiers: readonly string[];
  readonly sourceIds: readonly string[];
  /** Datamuse returns words, not documents: render as a phrase panel. */
  readonly phrases?: boolean;
}

export interface Category {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  /** Placeholder card only — no fan-out, no sources. */
  readonly deferred?: boolean;
  readonly subcategories: readonly Subcategory[];
}

export const CATEGORIES: readonly Category[] = [
  {
    id: "research",
    label: "Research",
    blurb: "Open-access papers and datasets behind the idea.",
    subcategories: [
      {
        id: "literature",
        label: "Literature",
        modifiers: [],
        sourceIds: ["openalex", "europepmc"],
      },
      {
        id: "reviews",
        label: "Reviews & surveys",
        modifiers: ["review", "systematic review"],
        sourceIds: ["openalex", "europepmc"],
      },
      {
        id: "datasets",
        label: "Datasets",
        modifiers: ["dataset", "cohort", "corpus"],
        sourceIds: ["openalex", "europepmc"],
      },
    ],
  },
  {
    id: "art",
    label: "Art & creativity",
    blurb: "Openly licensed images and artwork you can actually reuse.",
    subcategories: [
      {
        id: "posters",
        label: "Posters & designs",
        modifiers: ["poster", "campaign"],
        sourceIds: ["openverse", "commons", "artic"],
      },
      {
        id: "photography",
        label: "Photography",
        modifiers: ["photograph"],
        sourceIds: ["openverse", "commons"],
      },
      {
        id: "illustration",
        label: "Illustration & diagrams",
        modifiers: ["illustration", "diagram"],
        sourceIds: ["openverse", "commons"],
      },
      {
        id: "artworks",
        label: "Museum artworks",
        modifiers: [],
        sourceIds: ["artic", "met"],
      },
    ],
  },
  {
    id: "writing",
    label: "Writing",
    blurb: "Public-domain texts, terminology and phrase ideas to write from.",
    subcategories: [
      {
        id: "slogans",
        label: "Slogans & copy",
        modifiers: ["slogan", "motto", "rhetoric"],
        sourceIds: ["gutendex"],
        phrases: true,
      },
      {
        id: "reference",
        label: "Reference texts",
        modifiers: [],
        sourceIds: ["gutendex"],
      },
      {
        id: "terminology",
        label: "Terminology",
        modifiers: ["terminology", "glossary"],
        sourceIds: ["openalex"],
        phrases: true,
      },
    ],
  },
  {
    id: "policy",
    label: "Policy",
    blurb: "Deferred. Federal Register first when it resumes — keyless, and US federal works are public domain by statute.",
    deferred: true,
    subcategories: [],
  },
];

export function findCategory(id: string): Category | null {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}

export function findSubcategory(
  category: Category,
  id: string | null | undefined,
): Subcategory | null {
  if (!id) return null;
  return category.subcategories.find((s) => s.id === id) ?? null;
}

export interface Plan {
  readonly categoryId: string;
  readonly subcategoryId: string | null;
  readonly query: string;
  readonly sourceIds: readonly string[];
  readonly phrases: boolean;
}

/**
 * Turns the raw idea text into a per-source query: keywords from the idea
 * plus the subcategory's steering terms. With no subcategory chosen, every
 * source the category knows about is queried with the bare keywords.
 */
export function planFor(
  categoryId: string,
  subcategoryId: string | null,
  ideaText: string,
): Plan | null {
  const category = findCategory(categoryId);
  if (!category || category.deferred) return null;

  const subcategory = findSubcategory(category, subcategoryId);
  const terms = keywords(ideaText, 6);
  const base = terms.length > 0 ? terms.join(" ") : ideaText.trim();

  const sourceIds = subcategory
    ? subcategory.sourceIds
    : [...new Set(category.subcategories.flatMap((s) => s.sourceIds))];

  const modifiers = subcategory?.modifiers ?? [];

  return {
    categoryId: category.id,
    subcategoryId: subcategory?.id ?? null,
    query: [base, ...modifiers].join(" ").trim(),
    sourceIds,
    phrases: subcategory
      ? subcategory.phrases === true
      : category.subcategories.some((s) => s.phrases === true),
  };
}
