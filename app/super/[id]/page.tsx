import Link from "next/link";
import { notFound } from "next/navigation";

import { attachIdeaAction, detachIdeaAction } from "@/app/actions";
import { SharePanel } from "@/components/share-panel";
import { requireUser } from "@/lib/guard";
import { listIdeas, listPins } from "@/lib/ideas";
import {
  getSuperIdea,
  listIdeasIn,
  listSuperMembers,
  MAX_IDEAS_PER_SUPER,
} from "@/lib/supers";

export const dynamic = "force-dynamic";

export async function SuperIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const user = await requireUser(`/super/${id}`);
  const superIdea = await getSuperIdea(user.id, id);
  if (!superIdea) notFound();

  const query = await searchParams;
  const one = (key: string): string => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const [ideas, members, mine] = await Promise.all([
    listIdeasIn(id),
    listSuperMembers(id),
    listIdeas(user.id),
  ]);

  const counts = await Promise.all(
    ideas.map(async (idea) => ({ idea, pins: (await listPins(idea.id)).length })),
  );
  const total = counts.reduce((sum, entry) => sum + entry.pins, 0);

  // Only the user's own unfiled ideas can be added: filing someone else's idea
  // under your super idea would hand you their board.
  const available = mine.filter(
    (idea) => idea.superIdeaId === null && idea.ownerId === user.id,
  );
  const full = ideas.length >= MAX_IDEAS_PER_SUPER;

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/">← home</Link>
      </p>
      <h1 className="page">{superIdea.title}</h1>
      <p className="sub">
        {ideas.length} of {MAX_IDEAS_PER_SUPER} ideas · {total} pinned in total
        {total > 0 ? (
          <>
            {" · "}
            <Link className="exportlink" href={`/super/${superIdea.id}/print`}>
              Export as PDF
            </Link>
          </>
        ) : null}
      </p>

      {one("error") ? <p className="autherror">{one("error")}</p> : null}

      <SharePanel
        kind="super"
        targetId={superIdea.id}
        members={members}
        token={one("invite") || undefined}
      />

      {ideas.length === 0 ? (
        <div className="empty">
          No ideas filed here yet. Add up to {MAX_IDEAS_PER_SUPER} of your own
          below.
        </div>
      ) : (
        <ul className="cards">
          {counts.map(({ idea, pins }) => (
            <li key={idea.id} className="card">
              <Link href={`/idea/${idea.id}`}>
                <strong>{idea.title}</strong>
              </Link>
              <p className="sheetfacts">
                {pins} pinned · {idea.categoryIds.join(", ") || "no categories yet"}
              </p>
              {idea.ownerId === user.id ? (
                <form action={detachIdeaAction}>
                  <input type="hidden" name="superIdeaId" value={superIdea.id} />
                  <input type="hidden" name="ideaId" value={idea.id} />
                  <button type="submit">Remove from super idea</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <section className="section">
        <h2>Add an idea</h2>
        {full ? (
          <p className="sheetfacts">
            This super idea already holds {MAX_IDEAS_PER_SUPER}, which is the
            limit. Remove one first.
          </p>
        ) : available.length === 0 ? (
          <p className="sheetfacts">
            You have no unfiled ideas of your own. Create one from the home page
            first — an idea can belong to one super idea at most.
          </p>
        ) : (
          <form action={attachIdeaAction} className="draftbox">
            <input type="hidden" name="superIdeaId" value={superIdea.id} />
            <select name="ideaId" defaultValue={available[0]?.id}>
              {available.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
            </select>
            <button type="submit">Add to super idea</button>
          </form>
        )}
      </section>
    </main>
  );
}

export default SuperIdeaPage;
