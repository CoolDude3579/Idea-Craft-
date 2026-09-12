import Link from "next/link";
import { notFound } from "next/navigation";

import { saveDraftAction, unpinResult } from "@/app/actions";
import { ResultRow } from "@/components/result-row";
import { SharePanel } from "@/components/share-panel";
import { CATEGORIES, findCategory } from "@/lib/core/categories";
import { requireUser } from "@/lib/guard";
import { getDraft, getIdea, listDrafts, listMembers, listPins } from "@/lib/ideas";
import { getSuperIdea } from "@/lib/supers";

export const dynamic = "force-dynamic";

export async function IdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const user = await requireUser(`/idea/${id}`);
  const idea = await getIdea(user.id, id);
  if (!idea) notFound();

  const query = await searchParams;
  const one = (key: string): string => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const [pins, members, drafts, parent] = await Promise.all([
    listPins(id),
    listMembers(id),
    listDrafts(id),
    idea.superIdeaId ? getSuperIdea(user.id, idea.superIdeaId) : Promise.resolve(null),
  ]);

  // Each member searches from their own prompt; the pins land in this one
  // board. Falling back to the idea's query covers the member who has not
  // edited theirs yet.
  const myDraft = (await getDraft(user.id, id)) ?? idea.query;
  const others = drafts.filter((draft) => draft.userId !== user.id);

  const used = CATEGORIES.filter(
    (category) =>
      idea.categoryIds.includes(category.id) ||
      pins.some((p) => p.categoryId === category.id),
  );

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/">← home</Link>
        {parent ? (
          <>
            {" · "}
            <Link href={`/super/${parent.id}`}>{parent.title}</Link>
          </>
        ) : null}
      </p>
      <h1 className="page">{idea.title}</h1>
      <p className="sub">
        {pins.length} pinned · {used.length} categor{used.length === 1 ? "y" : "ies"} linked
        {" · "}
        {/* Always offered: a hidden export is one nobody finds. It opens the
            sheet as a preview — the print dialog is the user's own next step,
            never a surprise. */}
        <Link className="exportlink" href={`/idea/${idea.id}/print`}>
          Export as PDF
        </Link>
      </p>

      {one("error") ? <p className="autherror">{one("error")}</p> : null}

      <SharePanel
        kind="idea"
        targetId={idea.id}
        members={members}
        token={one("invite") || undefined}
      />

      <div className="draftbox">
        <span className="sharelabel">Your query for this idea</span>
        <form action={saveDraftAction}>
          <input type="hidden" name="ideaId" value={idea.id} />
          <input type="text" name="q" defaultValue={myDraft} />
          <button type="submit">Save</button>
        </form>
        {others.length > 0 ? (
          <ul className="othersdrafts">
            {others.map((draft) => (
              <li key={draft.userId}>
                {draft.name} is working from: “{draft.query}”
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ul className="chips">
        {CATEGORIES.map((category) => (
          <li key={category.id}>
            <Link
              className="chip"
              href={`/c/${category.id}?q=${encodeURIComponent(myDraft)}`}
              aria-current={idea.categoryIds.includes(category.id)}
            >
              {category.label}
            </Link>
          </li>
        ))}
      </ul>

      {pins.length === 0 ? (
        <div className="empty">
          Nothing pinned yet. Open a category above and pin what is worth keeping.
        </div>
      ) : (
        used.map((category) => {
          const rows = pins.filter((p) => p.categoryId === category.id);
          if (rows.length === 0) return null;
          return (
            <section className="section" key={category.id}>
              <h2>{findCategory(category.id)?.label ?? category.id}</h2>
              <ul className="results">
                {rows.map((row) => (
                  <ResultRow
                    key={row.id}
                    result={row.result}
                    actions={
                      <>
                        <span className="pinauthor">
                          kept by {row.authorId === user.id ? "you" : row.authorName}
                        </span>
                        <form action={unpinResult}>
                          <input type="hidden" name="ideaId" value={idea.id} />
                          <input type="hidden" name="sourceId" value={row.result.sourceId} />
                          <input
                            type="hidden"
                            name="sourceKey"
                            value={row.result.sourceKey}
                          />
                          <button type="submit">Unpin</button>
                        </form>
                      </>
                    }
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}

export default IdeaPage;
