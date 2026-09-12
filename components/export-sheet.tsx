import { attributionRequired, licenceLabel } from "@/lib/core/licence";
import { adapterLabel } from "@/lib/core/registry";
import type { SourceResult } from "@/types/source-result";

/**
 * The export sheet, shared by the idea and super-idea exports. Extracted
 * rather than copied: two divergent copies of a licence-credits block is how a
 * tool that sells licence accuracy ends up contradicting itself.
 */
export interface SheetEntry {
  readonly result: SourceResult;
  /** Who kept it. Null on a solo board, where saying so adds nothing. */
  readonly authorName: string | null;
}

export interface SheetGroup {
  /** Heading for this group's text sources — the idea's title in a super
      export, absent in a single-idea one. */
  readonly label: string | null;
  readonly entries: readonly SheetEntry[];
}

function isVisual(result: SourceResult): boolean {
  return result.kind === "image" || result.kind === "artwork";
}

function year(publishedAt: string | null): string | null {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
}

function provenance(entry: SheetEntry): string {
  return [
    licenceLabel(entry.result.licence),
    adapterLabel(entry.result.sourceId),
    year(entry.result.publishedAt),
    entry.result.attribution,
    entry.authorName ? `kept by ${entry.authorName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

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

function key(result: SourceResult): string {
  return `${result.sourceId}:${result.sourceKey}`;
}

export function ExportSheet({
  title,
  meta,
  groups,
}: {
  title: string;
  meta: string;
  groups: readonly SheetGroup[];
}) {
  const all = groups.flatMap((group) => group.entries);

  // Plates pool across every group and sit at the end, so the sheet reads as
  // prose and finishes on the visuals however many ideas fed it.
  const visuals = all.filter((entry) => isVisual(entry.result));

  // attributionRequired() answers true for UNKNOWN, which is right for a
  // warning badge but wrong for a credit line: there is no correct attribution
  // under a licence nobody has identified. Those get their own section.
  const credited = all.filter(
    (entry) =>
      entry.result.licence !== "UNKNOWN" && attributionRequired(entry.result.licence),
  );
  const unstated = all.filter((entry) => entry.result.licence === "UNKNOWN");

  return (
    <>
      <header className="sheethead">
        <h1>{title}</h1>
        <p className="sheetmeta">{meta}</p>
      </header>

      {all.length === 0 ? (
        <p className="sheetempty">
          Nothing kept yet, so this sheet is empty. Open or pin results in a
          category first.
        </p>
      ) : null}

      {groups.map((group) => {
        const texts = group.entries.filter((entry) => !isVisual(entry.result));
        if (texts.length === 0) return null;
        return (
          <section className="sheetsection" key={group.label ?? "sources"}>
            <h2>{group.label ? `Sources — ${group.label}` : "Sources"}</h2>
            <ol className="sheetrows">
              {texts.map((entry) => (
                <li key={key(entry.result)}>
                  <p className="sheettitle">{entry.result.title}</p>
                  <p className="sheetsnippet">
                    {entry.result.snippet ?? (
                      <span className="sheetfacts">
                        No abstract supplied by the provider.
                      </span>
                    )}
                  </p>
                  <p className="sheeturl">{entry.result.url}</p>
                  <p className="sheetfacts">{provenance(entry)}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      {visuals.length > 0 ? (
        <section className="sheetsection">
          <h2>Images</h2>
          <div className="plates">
            {visuals.map((entry) => (
              <figure className="plate" key={key(entry.result)}>
                {entry.result.thumbnailUrl ? (
                  // Hotlinked from the provider, exactly as on screen.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.result.thumbnailUrl} alt={entry.result.title} />
                ) : (
                  <div className="plateblank">No thumbnail supplied</div>
                )}
                {/* Link first, hard against the plate: for an image the URL is
                    what the reader acts on. */}
                <figcaption>
                  <span className="sheeturl">{entry.result.url}</span>
                  <span className="sheettitle">{entry.result.title}</span>
                  <span className="sheetfacts">{provenance(entry)}</span>
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
            {credited.map((entry) => (
              <li key={key(entry.result)}>
                <p className="sheetsnippet">{creditLine(entry.result)}</p>
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
            {unstated.map((entry) => (
              <li key={key(entry.result)}>
                <p className="sheetsnippet">
                  {entry.result.title} — {adapterLabel(entry.result.sourceId)} (
                  {entry.result.url})
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The sheet embeds provider thumbnails, so a blanket "nothing is
          reproduced here" would be false on any export with images. */}
      <p className="sheetfoot">
        Compiled by Idea Craft. Every entry is a deep link to its provider
        and nothing is stored by Idea Craft; the plates above are the
        providers&rsquo; own thumbnails, reproduced here under the licences
        stated beside them. Licences are reported as the provider states them —
        verify before reuse, and check the terms before redistributing this
        sheet.
      </p>
    </>
  );
}

export default ExportSheet;
