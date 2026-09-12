import Link from "next/link";
import { notFound } from "next/navigation";

import { pinResult, saveIdea } from "@/app/actions";
import { PhrasePanel } from "@/components/phrase-panel";
import { ResultRow } from "@/components/result-row";
import { SearchForm } from "@/components/search-form";
import { requireUser } from "@/lib/guard";
import { findIdeaByQuery, listIdeas, pinnedKeys } from "@/lib/ideas";
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
  const user = await requireUser();
  const { category: categoryId } = await params;
  const category = findCategory(categoryId);
  if (!category) notFound();

  const search = await searchParams;
  const query = first(search["q"]);
  const subcategoryId = first(search["sub"]) || null;

  const plan = query ? planFor(category.id, subcategoryId, query) : null;

  // Fan-out, phrases and the already-kept set are independent: none waits on
  // another.
  const [federated, phrases, existing] = await Promise.all([
    plan ? federate(plan) : Promise.resolve(null),
    plan?.phrases && !fixturesEnabled()
      ? phrasesFor(query)
      : Promise.resolve([] as PhraseSet[]),
    query ? findIdeaByQuery(user.id, query) : Promise.resolve(null),
  ]);

  const kept = existing ? await pinnedKeys(existing.id) : new Set<string>();
  const boards = (await listIdeas(user.id)).filter((idea) => idea.id !== existing?.id);

  const href = (sub: string | null) =>
    `/c/${category.id}?q=${encodeURIComponent(query)}${sub ? `&sub=${sub}` : ""}`;

  const visuals = (federated?.items ?? []).filter(
    (item) => item.result.kind === "image" || item.result.kind === "artwork",
  );
  const texts = (federated?.items ?? []).filter(
    (item) => !(item.result.kind === "image" || item.result.kind === "artwork"),
  );

  const pinForm = (result: (typeof texts)[number]["result"]) => (
    <form action={pinResult}>
      <input type="hidden" name="q" value={query} />
      <input type="hidden" name="category" value={category.id} />
      <input type="hidden" name="result" value={JSON.stringify(result)} />
      <button type="submit">Pin</button>
    </form>
  );

  return (
    <main>
      {category.deferred ? (
        <>
          <p className="breadcrumb">
            <Link href={`/?q=${encodeURIComponent(query)}`}>← all angles</Link>
          </p>
          <h1 className="page">{category.label}</h1>
          <p className="sub">{category.blurb}</p>
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
        </>
      ) : (
        <div className="work">
          {/* Sidebar: what this angle is, and the boards already going. It is
              the one place the reference design keeps context while the main
              column churns through results. */}
          <aside className="aside">
            <p className="breadcrumb">
              <Link href={`/?q=${encodeURIComponent(query)}`}>← all angles</Link>
            </p>
            <div>
              <span className="fieldlabel">Focus angle</span>
              <p className="asidetitle">{category.label}</p>
              <p className="sub" style={{ margin: 0, fontSize: 13 }}>
                {category.blurb}
              </p>
            </div>

            {existing ? (
              <div>
                <span className="fieldlabel">Active board</span>
                <div className="asidecard">
                  <h3>“{existing.title}”</h3>
                  <p>
                    {kept.size} {kept.size === 1 ? "source" : "sources"} kept ·{" "}
                    <Link href={`/idea/${existing.id}`}>open board →</Link>
                  </p>
                </div>
              </div>
            ) : null}

            {boards.length > 0 ? (
              <div>
                <span className="fieldlabel">Saved boards ({boards.length})</span>
                {boards.slice(0, 3).map((board) => (
                  <div className="asidecard" key={board.id} style={{ marginTop: 8 }}>
                    <h3>“{board.title}”</h3>
                    <p>
                      <Link href={`/idea/${board.id}`}>open →</Link>
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </aside>

          <div>
            <h1 className="page">{category.label}</h1>
            <p className="sub">{category.blurb}</p>

            <SearchForm
              action={`/c/${category.id}`}
              defaultValue={query}
              hidden={subcategoryId ? { sub: subcategoryId } : {}}
            />

            <div className="tabsrow">
              <ul className="tabs">
                <li>
                  <Link
                    className="tab"
                    href={href(null)}
                    aria-current={subcategoryId === null}
                  >
                    Everything
                  </Link>
                </li>
                {category.subcategories.map((sub) => (
                  <li key={sub.id}>
                    <Link
                      className="tab"
                      href={href(sub.id)}
                      aria-current={subcategoryId === sub.id}
                    >
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {query ? (
                <form action={saveIdea}>
                  <input type="hidden" name="q" value={query} />
                  <input type="hidden" name="category" value={category.id} />
                  <button className="primary" type="submit">
                    Save as an idea
                  </button>
                </form>
              ) : null}
            </div>

            {fixturesEnabled() ? (
              <p className="notice">
                DEMO_FIXTURES=1 — showing offline placeholder records, not live
                provider data. Phrase ideas are off in this mode.
              </p>
            ) : null}

            {!query ? (
              <div className="empty">
                Enter an idea above to fan out to this angle&apos;s sources.
              </div>
            ) : null}

            {federated ? (
              <>
                <SourceBar
                  sources={federated.sources}
                  rawCount={federated.rawCount}
                  dedupedCount={federated.dedupedCount}
                  ms={federated.ms}
                  cached={federated.cached}
                  stale={federated.stale}
                  fetchedAt={federated.fetchedAt}
                />

                <p className="hint">
                  Opening a result keeps it with this idea. Use <b>Pin</b> to
                  keep one without leaving, or <b>Unpin</b> on the board to drop
                  it.
                </p>

                {federated.items.length === 0 ? (
                  <div className="nomatch">
                    <h2>No open-licence matches found</h2>
                    <p>
                      Every source this angle queries came back without a record
                      matching that phrasing. Nothing was guessed or generated
                      to fill the gap.
                    </p>
                    <div className="tips">
                      <div className="tip">
                        <h3>Broaden the vocabulary</h3>
                        <p>
                          Swap narrow terms for the words a cataloguer would
                          use — “physics laboratory safety” over a specific
                          apparatus name.
                        </p>
                      </div>
                      <div className="tip">
                        <h3>Check the spelling</h3>
                        <p>
                          Matching runs on provider titles and metadata, so an
                          unusual spelling finds nothing at all.
                        </p>
                      </div>
                      <div className="tip">
                        <h3>Try another angle</h3>
                        <p>
                          A phrase with no papers behind it often has posters or
                          public-domain texts.
                        </p>
                      </div>
                    </div>
                    <Link className="btn" href={`/?q=${encodeURIComponent(query)}`}>
                      Back to all angles
                    </Link>
                  </div>
                ) : null}

                {texts.length > 0 ? (
                  <ul className="results" style={{ marginTop: 18 }}>
                    {texts.map(({ result, reasons }) => (
                      <ResultRow
                        key={`${result.sourceId}:${result.sourceKey}`}
                        result={result}
                        reasons={reasons}
                        visit={{ query, categoryId: category.id }}
                        pinned={kept.has(`${result.sourceId}:${result.sourceKey}`)}
                        actions={pinForm(result)}
                      />
                    ))}
                  </ul>
                ) : null}

                {visuals.length > 0 ? (
                  <ul className="tiles">
                    {visuals.map(({ result, reasons }) => (
                      <ResultRow
                        key={`${result.sourceId}:${result.sourceKey}`}
                        result={result}
                        reasons={reasons}
                        visit={{ query, categoryId: category.id }}
                        pinned={kept.has(`${result.sourceId}:${result.sourceKey}`)}
                        actions={pinForm(result)}
                      />
                    ))}
                  </ul>
                ) : null}

                <PhrasePanel sets={phrases} />
              </>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}

export default CategoryPage;
