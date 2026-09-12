import Link from "next/link";

import { createSuperIdeaAction } from "@/app/actions";
import { AngleIcon } from "@/components/angle-icon";
import { SearchForm } from "@/components/search-form";
import { CATEGORIES } from "@/lib/core/categories";
import { keywords } from "@/lib/core/keywords";
import { requireUser } from "@/lib/guard";
import { listIdeas } from "@/lib/ideas";
import { listSuperIdeas } from "@/lib/supers";
import { SOURCE_LABELS } from "@/lib/core/source-labels";

export const dynamic = "force-dynamic";

const EXAMPLE = "a cancer awareness campaign for my campus";

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes)) return "saved";
  if (minutes < 2) return "saved just now";
  if (minutes < 60) return `saved ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `saved ${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "saved yesterday" : `saved ${days} days ago`;
}

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

  // Every source an angle can reach, for the provider line on its card.
  const providersFor = (categoryId: string): string[] => {
    const category = CATEGORIES.find((c) => c.id === categoryId);
    return [
      ...new Set((category?.subcategories ?? []).flatMap((s) => s.sourceIds)),
    ].map((id) => SOURCE_LABELS[id] ?? id);
  };

  return (
    <main>
      <section className="hero">
        <h1 className="lede">
          <span>One idea in.</span>
          <span>Open-licence sources out.</span>
        </h1>
        <p className="sub">
          Describe what you are trying to make. Idea Craft finds the research,
          visuals and language behind it — with reuse rights attached.
        </p>

        <div className="herosearch">
          <SearchForm action="/" defaultValue={query} />
          {query ? null : (
            <p className="example">
              Try an example:
              <Link href={`/?q=${encodeURIComponent(EXAMPLE)}`}>{EXAMPLE} ↗</Link>
            </p>
          )}
        </div>
      </section>

      <section className="band">
        <h2>
          {query ? "Explore your idea from different angles" : "Start with an idea. We will find the rest."}
        </h2>
        <p>
          {query
            ? `Searching for: ${terms.length > 0 ? terms.join(" · ") : query}`
            : "Discovery across open archives, Creative Commons and public collections — every result licence-tagged."}
        </p>

        <div className="angles">
          {CATEGORIES.map((category) => {
            const providers = providersFor(category.id);
            const body = (
              <>
                <span className="angleicon">
                  <AngleIcon categoryId={category.id} />
                </span>
                <h3>{category.label}</h3>
                <p>{category.blurb}</p>

                {category.subcategories.length > 0 ? (
                  <div>
                    <span className="fieldlabel">Focus areas</span>
                    <p className="sub" style={{ margin: 0, fontSize: 12.5 }}>
                      {category.subcategories.map((s) => s.label).join(" · ")}
                    </p>
                  </div>
                ) : null}

                <div>
                  <span className="fieldlabel">Sources</span>
                  <p className="providers">
                    {providers.length > 0 ? providers.join(" · ") : "Coming later"}
                  </p>
                </div>

                <span className={category.deferred ? "explore disabled" : "explore"}>
                  {category.deferred ? "Locked" : `Explore ${category.label} →`}
                </span>
              </>
            );

            // A deferred angle is a card, not a link: nothing to search yet.
            return category.deferred ? (
              <div className="angle locked" key={category.id}>
                {body}
              </div>
            ) : (
              <Link
                className="angle"
                key={category.id}
                href={`/c/${category.id}${query ? `?q=${encodeURIComponent(query)}` : ""}`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      {ideas.length > 0 ? (
        <section className="band" style={{ textAlign: "left" }}>
          <div className="rowhead">
            <h2 style={{ fontFamily: "inherit", fontSize: 14 }}>Saved ideas</h2>
            <span className="tagline">{ideas.length} in total</span>
          </div>
          <div className="boards">
            {ideas.map((idea) => (
              <Link className="board" key={idea.id} href={`/idea/${idea.id}`}>
                <span className="countpill">
                  {idea.categoryIds.length > 0
                    ? `${idea.categoryIds.length} ${idea.categoryIds.length === 1 ? "angle" : "angles"} linked`
                    : "no angles yet"}
                </span>
                <h3>“{idea.title}”</h3>
                <div className="boardfoot">
                  <span>
                    {relative(idea.createdAt)}
                    {idea.ownerId === user.id ? "" : " · shared with you"}
                  </span>
                  <span className="go">Open board →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="band" style={{ textAlign: "left" }}>
        <div className="rowhead">
          <h2 style={{ fontFamily: "inherit", fontSize: 14 }}>Super ideas</h2>
          <span className="tagline">up to three ideas, exported as one pack</span>
        </div>

        {supers.length > 0 ? (
          <div className="boards">
            {supers.map((superIdea) => (
              <Link className="board" key={superIdea.id} href={`/super/${superIdea.id}`}>
                <span className="countpill">super idea</span>
                <h3>{superIdea.title}</h3>
                <div className="boardfoot">
                  <span>{superIdea.ownerId === user.id ? "yours" : "shared with you"}</span>
                  <span className="go">Open →</span>
                </div>
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
