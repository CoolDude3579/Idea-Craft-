import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExportSheet, type SheetEntry } from "@/components/export-sheet";
import { PrintButton } from "@/components/print-button";
import { currentUser } from "@/lib/auth";
import { requireUser } from "@/lib/guard";
import { getIdea, listMembers, listPins } from "@/lib/ideas";

export const dynamic = "force-dynamic";

/** Browsers name the saved PDF after document.title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // currentUser, not requireUser: metadata generation must not redirect, and
  // the page body below does the guarding anyway.
  const user = await currentUser();
  const idea = user ? await getIdea(user.id, id) : null;
  return { title: idea ? idea.title : "IdeaCraft" };
}

export async function PrintIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/idea/${id}/print`);
  const idea = await getIdea(user.id, id);
  if (!idea) notFound();

  const [pins, members] = await Promise.all([listPins(id), listMembers(id)]);
  const shared = members.length > 1;

  // Authorship is only worth printing on a shared board; on a solo one every
  // line would say the same name.
  const entries: SheetEntry[] = pins.map((p) => ({
    result: p.result,
    authorName: shared ? p.authorName : null,
  }));

  const visuals = entries.filter(
    (e) => e.result.kind === "image" || e.result.kind === "artwork",
  ).length;

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

      <ExportSheet
        title={idea.title}
        meta={[
          `Query: ${idea.query}`,
          `${entries.length - visuals} text source${entries.length - visuals === 1 ? "" : "s"}`,
          `${visuals} image${visuals === 1 ? "" : "s"}`,
          shared ? `shared by ${members.map((m) => m.name).join(" and ")}` : null,
          `exported ${new Date().toISOString().slice(0, 10)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        groups={[{ label: null, entries }]}
      />
    </main>
  );
}

export default PrintIdeaPage;
