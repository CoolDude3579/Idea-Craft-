import { NextResponse } from "next/server";

import { ccFamilyLabel, spdxFromUrl, toSpdx } from "@/lib/core/licence";

export const dynamic = "force-dynamic";

/**
 * Smoke surface, not part of the demo. Runs the licence mapper over the
 * exact spellings each provider was verified to return, so a regression in
 * lib/core/licence.ts fails `npm run smoke` instead of quietly turning
 * every art result into "Licence unknown".
 */
const CASES: readonly { readonly provider: string; readonly got: string; readonly want: string }[] =
  [
    { provider: "openverse", got: toSpdx("by-sa", "2.0"), want: "CC-BY-SA-2.0" },
    { provider: "openverse", got: toSpdx("by", "4.0"), want: "CC-BY-4.0" },
    { provider: "openverse", got: toSpdx("by-nc-nd", "3.0"), want: "CC-BY-NC-ND-3.0" },
    { provider: "openverse", got: toSpdx("cc0", null), want: "CC0-1.0" },
    { provider: "openverse", got: toSpdx("pdm", null), want: "CC-PDDC" },
    // Europe PMC and OpenAlex state the family but not the version, so the
    // mapper refuses to assume 4.0 — the family is surfaced from raw instead.
    { provider: "europepmc", got: toSpdx("cc by"), want: "UNKNOWN" },
    { provider: "europepmc", got: ccFamilyLabel("cc by") ?? "", want: "CC BY" },
    { provider: "europepmc", got: toSpdx("cc by-nc"), want: "UNKNOWN" },
    { provider: "europepmc", got: ccFamilyLabel("cc by-nc") ?? "", want: "CC BY-NC" },
    { provider: "europepmc", got: toSpdx(null), want: "UNKNOWN" },
    { provider: "openalex", got: toSpdx("cc-by"), want: "UNKNOWN" },
    { provider: "openalex", got: ccFamilyLabel("cc-by") ?? "", want: "CC BY" },
    { provider: "openalex", got: toSpdx(null), want: "UNKNOWN" },
    { provider: "commons", got: toSpdx("cc-by-sa-4.0"), want: "CC-BY-SA-4.0" },
    { provider: "commons", got: toSpdx("cc-by-sa-3.0"), want: "CC-BY-SA-3.0" },
    { provider: "commons", got: toSpdx("pd"), want: "CC-PDDC" },
    {
      provider: "licence-url",
      got: spdxFromUrl("https://creativecommons.org/licenses/by-sa/2.0/"),
      want: "CC-BY-SA-2.0",
    },
    {
      provider: "licence-url",
      got: spdxFromUrl("https://creativecommons.org/publicdomain/zero/1.0/"),
      want: "CC0-1.0",
    },
    { provider: "unmapped", got: toSpdx("publisher's own licence"), want: "UNKNOWN" },
    { provider: "unversioned-cc", got: toSpdx("by-sa", null), want: "UNKNOWN" },
    { provider: "unversioned-cc", got: ccFamilyLabel("by-sa") ?? "", want: "CC BY-SA" },
    { provider: "unmapped", got: ccFamilyLabel("publisher's own licence") ?? "none", want: "none" },
  ];

export async function GET(): Promise<NextResponse> {
  const failures = CASES.filter((c) => c.got !== c.want);
  return NextResponse.json(
    { total: CASES.length, failures },
    { status: failures.length === 0 ? 200 : 500 },
  );
}
