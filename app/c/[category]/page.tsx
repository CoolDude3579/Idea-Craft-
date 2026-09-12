import Link from "next/link";
import { notFound } from "next/navigation";

import { pinResult, saveIdea } from "@/app/actions";
import { PhrasePanel } from "@/components/phrase-panel";
import { ResultRow } from "@/components/result-row";
import { SearchForm } from "@/components/search-form";
import { SourceBar } from "@/components/source-bar";
import { findCategory, planFor } from "@/lib/core/categories";
import { federate } from "@/lib/core/federate";
import { fixturesEnabled } from "@/lib/fixtures";
import { phrasesFor, type PhraseSet } from "@/lib/phrases/datamuse";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category: categoryId } = await params;
  const category = findCategory(categoryId);
  if (!category) notFound();

  const search = await searchParams;
  const query = first(search["q"]);
  const subcategoryId = first(search["sub"]) || null;

  const plan = query ? planFor(category.id, subcategoryId, query) : null;

  // Fan-out and phrases are independent: neither waits on the other.
  const [federated, phrases] = await Promise.all([
    plan ? federate(plan) : Promise.resolve(null),
    plan?.phrases && !fixturesEnabled()
      ? phrasesFor(query)
      : Promise.resolve([] as PhraseSet[]),
  ]);

  const href = (sub: string | null) =>
    `/c/${category.id}?q=${encodeURIComponent(query)}${sub ? `&sub=${sub}` : ""}`;

  return (
    <main>
      <p className="breadcrumb">
        <Link href={`/?q=${encodeURIComponent(query)}`}>← all angles</Link>
      </p>
      <h1 className="page">{category.label}</h1>
      <p className="sub">{category.blurb}</p>

      {category.deferred ? (
        <div className="deferred">
          <h2>Not built yet</h2>
          <p>
            Policy lookups are deferred. When they resume, the first source is
            the US Federal Register API: keyless, and US federal works are
            public domain by statute.
          </p>
          <p>
            <Link href={`/?q=${encodeURIComponent(query)}`}>
              Back to the other angles
            </Link>
          </p>
        </div>
      ) : (
        <>
          <SearchForm
            action={`/c/${category.id}`}
            defaultValue={query}
            hidden={subcategoryId ? { sub: subcategoryId } : {}}
          />

          <ul className="chips">
            <li>
              <Link className="chip" href={href(null)} aria-current={subcategoryId === null}>
                Everything
              </Link>
            </li>
            {category.subcategories.map((sub) => (
              <li key={sub.id}>
                <Link
                  className="chip"
                  href={href(sub.id)}
                  aria-current={subcategoryId === sub.id}
                >
                  {sub.label}
                </Link>
              </li>
            ))}
          </ul>

          {fixturesEnabled() ? (
            <p className="notice">
              DEMO_FIXTURES=1 — showing offline placeholder records, not live
              provider data. Phrase ideas are off in this mode.
            </p>
          ) : null}

          {!query ? (
            <div className="empty">
              Enter an idea above to fan out to this category&apos;s sources.
            </div>
          ) : null}

          {federated ? (
            <>
              <SourceBar
                sources={federated.sources}
                rawCount={federated.rawCount}
                dedupedCount={federated.dedupedCount}
                ms={federated.ms}
              />

              <form action={saveIdea} style={{ marginTop: 16 }}>
                <input type="hidden" name="q" value={query} />
                <input type="hidden" name="category" value={category.id} />
                <button type="submit">Save as an idea</button>
              </form>

              {federated.items.length === 0 ? (
                <div className="empty">
                  No open-licence results for that phrasing. Try fewer, plainer
                  words.
                </div>
              ) : (
                <ul className="results">
                  {federated.items.map(({ result, reasons }) => (
                    <ResultRow
                      key={`${result.sourceId}:${result.sourceKey}`}
                      result={result}
                      reasons={reasons}
                      actions={
                        <form action={pinResult}>
                          <input type="hidden" name="q" value={query} />
                          <input type="hidden" name="category" value={category.id} />
                          <input
                            type="hidden"
                            name="result"
                            value={JSON.stringify(result)}
                          />
                          <button type="submit">Pin</button>
                        </form>
                      }
                    />
                  ))}
                </ul>
              )}

              <PhrasePanel sets={phrases} />
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

export default CategoryPage;
