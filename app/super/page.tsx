import Link from "next/link";

import { createSuperIdeaAction } from "@/app/actions";
import { requireUser } from "@/lib/guard";
import { listPins } from "@/lib/ideas";
import { listIdeasIn, listSuperIdeas, MAX_IDEAS_PER_SUPER } from "@/lib/supers";

export const dynamic = "force-dynamic";

/**
 * Super ideas get their own page now that the home screen offers them as an
 * angle rather than a form at the bottom. Creating one lives here, so removing
 * that form from home took the feature nowhere — it moved.
 */
export async function SuperIdeasPage() {
  const user = await requireUser("/super");
  const supers = await listSuperIdeas(user.id);

  const counted = await Promise.all(
    supers.map(async (superIdea) => {
      const ideas = await listIdeasIn(superIdea.id);
      const pins = await Promise.all(ideas.map((idea) => listPins(idea.id)));
      return {
        superIdea,
        ideas: ideas.length,
        pins: pins.reduce((sum, list) => sum + list.length, 0),
      };
    }),
  );

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/">← home</Link>
      </p>
      <h1 className="page">Super ideas</h1>
      <p className="sub">
        A project too big for one idea&rsquo;s angles: group up to{" "}
        {MAX_IDEAS_PER_SUPER} ideas and export them as a single pack, with every
        licence and credit carried through.
      </p>

      {counted.length > 0 ? (
        <div className="boards" style={{ marginTop: 24 }}>
          {counted.map(({ superIdea, ideas, pins }) => (
            <Link className="board" key={superIdea.id} href={`/super/${superIdea.id}`}>
              <span className="countpill">
                {ideas} of {MAX_IDEAS_PER_SUPER} ideas
              </span>
              <h3>{superIdea.title}</h3>
              <div className="boardfoot">
                <span>
                  {pins} {pins === 1 ? "source" : "sources"} in total
                  {superIdea.ownerId === user.id ? "" : " · shared with you"}
                </span>
                <span className="go">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 24 }}>
          No super ideas yet. Name one below, then file up to{" "}
          {MAX_IDEAS_PER_SUPER} of your ideas under it.
        </div>
      )}

      <section className="section">
        <h2>Create a super idea</h2>
        <form action={createSuperIdeaAction} className="draftbox">
          <input
            type="text"
            name="title"
            placeholder="Name a super idea — e.g. campus health campaign"
            required
          />
          <button className="primary" type="submit">
            Create super idea
          </button>
        </form>
      </section>
    </main>
  );
}

export default SuperIdeasPage;
