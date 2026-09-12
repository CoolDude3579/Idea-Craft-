import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExportSheet, type SheetGroup } from "@/components/export-sheet";
import { PrintButton } from "@/components/print-button";
import { currentUser } from "@/lib/auth";
import { requireUser } from "@/lib/guard";
import { getSuperIdea, listSuperMembers, listSuperPins } from "@/lib/supers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await currentUser();
  const superIdea = user ? await getSuperIdea(user.id, id) : null;
  return { title: superIdea ? superIdea.title : "IdeaCraft" };
}

export async function PrintSuperIdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/super/${id}/print`);
  const superIdea = await getSuperIdea(user.id, id);
  if (!superIdea) notFound();

  const [perIdea, members] = await Promise.all([
    listSuperPins(id),
    listSuperMembers(id),
  ]);
  const shared = members.length > 1;

  // One group per idea, so the text sources stay under the idea that found
  // them while the plates pool at the end of the whole pack.
  const groups: SheetGroup[] = perIdea.map(({ idea, pins }) => ({
    label: idea.title,
    entries: pins.map((p) => ({
      result: p.result,
      authorName: shared ? p.authorName : null,
    })),
  }));

  const all = groups.flatMap((group) => group.entries);
  const visuals = all.filter(
    (e) => e.result.kind === "image" || e.result.kind === "artwork",
  ).length;

  return (
    <main className="sheet">
      <div className="noprint printbar">
        <Link href={`/super/${superIdea.id}`}>← back to the super idea</Link>
        <span className="printhint">
          Preview below. <b>Save as PDF</b> opens your browser&rsquo;s print
          dialog — choose <b>Save as PDF</b> as the destination.
        </span>
        <PrintButton />
      </div>

      <ExportSheet
        title={superIdea.title}
        meta={[
          `${perIdea.length} idea${perIdea.length === 1 ? "" : "s"}`,
          `${all.length - visuals} text source${all.length - visuals === 1 ? "" : "s"}`,
          `${visuals} image${visuals === 1 ? "" : "s"}`,
          shared ? `shared by ${members.map((m) => m.name).join(" and ")}` : null,
          `exported ${new Date().toISOString().slice(0, 10)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        groups={groups}
      />
    </main>
  );
}

export default PrintSuperIdeaPage;
