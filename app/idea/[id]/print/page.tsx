import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print-button";
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

/** Visual sources go in the plate section; everything else reads as text. */
function isVisual(result: SourceResult): boolean {
  return result.kind === "image" || result.kind === "artwork";
}

function year(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
}

/** Provenance for one entry: licence, terms, provider, date, creator. */
function provenance(result: SourceResult): string {
  const published = year(result.publishedAt);
  return [
    licenceLabel(result.licence),
    adapterLabel(result.sourceId),
    published,
    result.attribution,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A credit line in the shape the licence asks for: creator, title, licence,
 * link. Only for licences that actually require attribution and that we could
 * identify — see the unstated section for the rest.
 */
function creditLine(result: SourceResult): string {
  return [
    result.attribution ? `${result.attribution},` : null,
    `"${result.title}"`,
    `— ${licenceLabel(result.licence)}`,
    `(${result.url})`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function PrintIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idea = await getIdea(id);
  if (!idea) notFound();

  const kept = (await listPins(id)).map((p) => p.result);

  // One pass, two buckets: the sheet reads as prose first, plates last, which
  // is also the cheapest thing to render and the easiest to follow.
  const texts = kept.filter((result) => !isVisual(result));
  const visuals = kept.filter(isVisual);

  // attributionRequired() answers true for UNKNOWN, which is right for a
  // warning badge but wrong for a credit line: there is no correct attribution
  // under a licence nobody has identified. Those get their own section.
  const credited = kept.filter(
    (r) => r.licence !== "UNKNOWN" && attributionRequired(r.licence),
  );
  const unstated = kept.filter((r) => r.licence === "UNKNOWN");

  return (
    <main className="sheet">
      <div className="noprint printbar">
        <Link href={`/idea/${idea.id}`}>← back to the idea</Link>
        <span className="printhint">
          Preview below. <b>Save as PDF</b> opens your browser&rsquo;s print
          dialog — choose <b>Save as PDF</b> as the destination.
        </span>
        <PrintButton />
      </div>

      <header className="sheethead">
        <h1>{idea.title}</h1>
        <p className="sheetmeta">
          Query: {idea.query} · {texts.length} text source
          {texts.length === 1 ? "" : "s"} · {visuals.length} image
          {visuals.length === 1 ? "" : "s"} · exported{" "}
          {new Date().toISOString().slice(0, 10)}
        </p>
      </header>

      {kept.length === 0 ? (
        <p className="sheetempty">
          Nothing kept yet, so this sheet is empty. Open or pin results in a
          category first.
        </p>
      ) : null}

      {texts.length > 0 ? (
        <section className="sheetsection">
          <h2>Sources</h2>
          <ol className="sheetrows">
            {texts.map((result) => (
              <li key={`${result.sourceId}:${result.sourceKey}`}>
                <p className="sheettitle">{result.title}</p>
                <p className="sheetsnippet">
                  {result.snippet ?? (
                    <span className="sheetfacts">
                      No abstract supplied by the provider.
                    </span>
                  )}
                </p>
                <p className="sheeturl">{result.url}</p>
                <p className="sheetfacts">{provenance(result)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {visuals.length > 0 ? (
        <section className="sheetsection">
          <h2>Images</h2>
          <div className="plates">
            {visuals.map((result) => (
              <figure className="plate" key={`${result.sourceId}:${result.sourceKey}`}>
                {result.thumbnailUrl ? (
                  // Hotlinked from the provider, exactly as on screen: the
                  // sheet holds no copy of the media either.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.thumbnailUrl} alt={result.title} />
                ) : (
                  <div className="plateblank">No thumbnail supplied</div>
                )}
                <figcaption>
                  <span className="sheettitle">{result.title}</span>
                  <span className="sheeturl">{result.url}</span>
                  <span className="sheetfacts">{provenance(result)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {credited.length > 0 ? (
        <section className="sheetsection">
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
        <section className="sheetsection">
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
