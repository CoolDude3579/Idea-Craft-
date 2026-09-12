import Link from "next/link";

import { SearchForm } from "@/components/search-form";
import { CATEGORIES } from "@/lib/core/categories";
import { keywords } from "@/lib/core/keywords";
import { listIdeas } from "@/lib/ideas";

export const dynamic = "force-dynamic";

export async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params["q"];
  const query = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const terms = keywords(query, 6);
  const ideas = await listIdeas();

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
                <p>{idea.categoryIds.join(" · ") || "no categories yet"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default Home;
