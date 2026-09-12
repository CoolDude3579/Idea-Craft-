import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { conditions } from "@/components/licence-badge";
import { PrintButton } from "@/components/print-button";
import { CATEGORIES, findCategory } from "@/lib/core/categories";
import { attributionRequired, licenceLabel } from "@/lib/core/licence";
import { adapterLabel } from "@/lib/core/registry";
import { getIdea, listPins } from "@/lib/ideas";
import type { SourceResult } from "@/types/source-result";

export const dynamic = "force-dynamic";

/** Browsers name the saved PDF after document.title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const idea = await getIdea(id);
  return { title: idea ? idea.title : "Idea Refinery" };
}

function published(result: SourceResult): string | null {
  if (!result.publishedAt) return null;
  const date = new Date(result.publishedAt);
  return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
}

/**
 * A credit line in the shape the licence actually asks for: creator, title,
 * licence, link. Only for rows whose licence requires attribution — the point
 * of tagging licences is that the user can reuse the work without guessing.
 */
function creditLine(result: SourceResult): string {
  const parts = [
    result.attribution ? `${result.attribution},` : null,
    `"${result.title}"`,
    `— ${licenceLabel(result.licence)}`,
    `(${result.url})`,
  ];
  return parts.filter(Boolean).join(" ");
}

export async function PrintIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const idea = await getIdea(id);
  if (!idea) notFound();

  const pins = await listPins(id);
  const used = CATEGORIES.filter((category) =>
    pins.some((p) => p.categoryId === category.id),
  );
  // attributionRequired() answers true for UNKNOWN, which is right for a
  // warning badge but wrong for a credit line: you cannot write a correct
  // attribution under a licence nobody has identified. So the unstated ones
  // get their own section telling the user what to do instead.
  const kept = pins.map((p) => p.result);
  const credited = kept.filter(
    (result) => result.licence !== "UNKNOWN" && attributionRequired(result.licence),
  );
  const unstated = kept.filter((result) => result.licence === "UNKNOWN");

  const auto = (Array.isArray(query["auto"]) ? query["auto"][0] : query["auto"]) === "1";

  return (
    <main className="sheet">
      <div className="noprint printbar">
        <Link href={`/idea/${idea.id}`}>← back to the idea</Link>
        <PrintButton auto={auto} />
      </div>

      <header className="sheethead">
        <h1>{idea.title}</h1>
        <p className="sheetmeta">
          Query: {idea.query} · {pins.length} source
          {pins.length === 1 ? "" : "s"} kept · exported{" "}
          {new Date().toISOString().slice(0, 10)}
        </p>
      </header>

      {pins.length === 0 ? (
        <p className="sheetempty">
          Nothing pinned yet, so this sheet is empty. Pin results in a category
          first.
        </p>
      ) : (
        used.map((category) => {
          const rows = pins.filter((p) => p.categoryId === category.id);
          return (
            <section className="sheetsection" key={category.id}>
              <h2>{findCategory(category.id)?.label ?? category.id}</h2>
              <ol className="sheetrows">
                {rows.map((row) => {
                  const year = published(row.result);
                  return (
                    <li key={row.id}>
                      <p className="sheettitle">{row.result.title}</p>
                      <p className="sheeturl">{row.result.url}</p>
                      <p className="sheetfacts">
                        {licenceLabel(row.result.licence)} ·{" "}
                        {conditions(row.result.licence)} ·{" "}
                        {adapterLabel(row.result.sourceId)}
                        {year ? ` · ${year}` : ""}
                        {row.result.attribution ? ` · ${row.result.attribution}` : ""}
                      </p>
                      {row.result.snippet ? (
                        <p className="sheetsnippet">{row.result.snippet}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })
      )}

      {credited.length > 0 ? (
        <section className="sheetsection credits">
          <h2>Credits required</h2>
          <p className="sheetfacts">
            These licences ask for attribution. Copy the line as-is when you
            reuse the work.
          </p>
          <ul className="sheetrows">
            {credited.map((result) => (
              <li key={`${result.sourceId}:${result.sourceKey}`}>
                <p className="sheetsnippet">{creditLine(result)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {unstated.length > 0 ? (
        <section className="sheetsection credits">
          <h2>Licence unstated</h2>
          <p className="sheetfacts">
            The provider did not state a licence version for these. Confirm the
            terms with the provider before reusing them — do not assume reuse is
            permitted.
          </p>
          <ul className="sheetrows">
            {unstated.map((result) => (
              <li key={`${result.sourceId}:${result.sourceKey}`}>
                <p className="sheetsnippet">
                  {result.title} — {adapterLabel(result.sourceId)} ({result.url})
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="sheetfoot">
        Compiled by Idea Refinery. Every entry is a deep link to its provider;
        no content is hosted or reproduced here. Licences are reported as the
        provider states them — verify before reuse.
      </p>
    </main>
  );
}

export default PrintIdeaPage;
