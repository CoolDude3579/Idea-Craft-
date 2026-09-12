import Link from "next/link";
import { notFound } from "next/navigation";

import { unpinResult } from "@/app/actions";
import { ResultRow } from "@/components/result-row";
import { CATEGORIES, findCategory } from "@/lib/core/categories";
import { getIdea, listPins } from "@/lib/ideas";

export const dynamic = "force-dynamic";

export async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = await getIdea(id);
  if (!idea) notFound();

  const pins = await listPins(id);
  const used = CATEGORIES.filter(
    (category) =>
      idea.categoryIds.includes(category.id) ||
      pins.some((p) => p.categoryId === category.id),
  );

  return (
    <main>
      <p className="breadcrumb">
        <Link href="/">← home</Link>
      </p>
      <h1 className="page">{idea.title}</h1>
      <p className="sub">
        {pins.length} pinned · {used.length} categor{used.length === 1 ? "y" : "ies"} linked
        {pins.length > 0 ? (
          <>
            {" · "}
            <Link className="exportlink" href={`/idea/${idea.id}/print?auto=1`}>
              Export as PDF
            </Link>
          </>
        ) : null}
      </p>

      <ul className="chips">
        {CATEGORIES.map((category) => (
          <li key={category.id}>
            <Link
              className="chip"
              href={`/c/${category.id}?q=${encodeURIComponent(idea.query)}`}
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
                      <form action={unpinResult}>
                        <input type="hidden" name="ideaId" value={idea.id} />
                        <input type="hidden" name="sourceId" value={row.result.sourceId} />
                        <input type="hidden" name="sourceKey" value={row.result.sourceKey} />
                        <button type="submit">Remove</button>
                      </form>
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
