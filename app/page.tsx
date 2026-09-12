import Link from "next/link";

import { createSuperIdeaAction } from "@/app/actions";
import { SearchForm } from "@/components/search-form";
import { CATEGORIES } from "@/lib/core/categories";
import { keywords } from "@/lib/core/keywords";
import { requireUser } from "@/lib/guard";
import { listIdeas } from "@/lib/ideas";
import { listSuperIdeas } from "@/lib/supers";

export const dynamic = "force-dynamic";

export async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/");
  const params = await searchParams;
  const raw = params["q"];
  const query = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const terms = keywords(query, 6);
  const [ideas, supers] = await Promise.all([
    listIdeas(user.id),
    listSuperIdeas(user.id),
  ]);

  return (
    <main>
      <h1 className="lede">One idea in. Open-licence sources out.</h1>
      <p className="sub">
        Type the idea, pick the angles it needs. Every result is a deep link to
        the provider, tagged with the licence they state.
      </p>

      <SearchForm action="/" defaultValue={query} />

      {query ? (
        <>
          <p className="tagline" style={{ marginTop: 16 }}>
            Searching for: {terms.length > 0 ? terms.join(" · ") : query}
          </p>
          <div className="cards">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                className="card"
                href={`/c/${category.id}?q=${encodeURIComponent(query)}`}
              >
                <h3>
                  {category.label}
                  {category.deferred ? <span className="pill down"> deferred</span> : null}
                </h3>
                <p>{category.blurb}</p>
              </Link>
            ))}
          </div>
          <p className="tagline" style={{ marginTop: 12 }}>
            One idea can take several angles at once — research the claim, find
            the poster art, write the slogan.
          </p>
        </>
      ) : (
        <div className="empty">
          Nothing refined yet. Try <em>a cancer awareness campaign for my campus</em>.
        </div>
      )}

      {ideas.length > 0 ? (
        <section className="section">
          <h2>Saved ideas</h2>
          <div className="cards">
            {ideas.map((idea) => (
              <Link key={idea.id} className="card" href={`/idea/${idea.id}`}>
                <h3>{idea.title}</h3>
                <p>
                  {idea.categoryIds.join(" · ") || "no categories yet"}
                  {idea.ownerId === user.id ? "" : " · shared with you"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2>Super ideas</h2>
        <p className="sheetfacts">
          A project too big for one idea&rsquo;s categories: group up to three
          ideas and export them as one pack.
        </p>
        {supers.length > 0 ? (
          <div className="cards">
            {supers.map((superIdea) => (
              <Link
                key={superIdea.id}
                className="card"
                href={`/super/${superIdea.id}`}
              >
                <h3>{superIdea.title}</h3>
                <p>
                  {superIdea.ownerId === user.id ? "yours" : "shared with you"}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
        <form action={createSuperIdeaAction} className="draftbox">
          <input
            type="text"
            name="title"
            placeholder="Name a super idea — e.g. campus health campaign"
            required
          />
          <button type="submit">Create super idea</button>
        </form>
      </section>
    </main>
  );
}

export default Home;
