// Run:
//   node --experimental-strip-types --import ./scripts/alias-hook.mjs \
//        scripts/try-openverse.ts
//
// Set OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET first to use the
// registered pool; without them it runs on the anonymous one (20/min).
//
// A blanket "HTTP 403" on every query means egress is blocked where you are
// running this, not that the adapter is broken — the API answers 200 with an
// empty results array even for nonsense queries.
import { adapter } from "@/lib/adapters/openverse/index.ts";
import type { SourceResult } from "@/types/source-result.ts";

interface Case {
  readonly name: string;
  readonly query: string;
  readonly expect: string;
}

// Expectations below were checked against the live API, not assumed.
const CASES: readonly Case[] = [
  {
    name: "normal",
    query: "awareness ribbon",
    expect: "20 results; licences skew to Flickr CC 2.0",
  },
  {
    name: "zero results",
    query: "zzqxjvbk nonexistent phrase 74920",
    expect: "HTTP 200 with results: [] — not a 404, so no error path",
  },
  {
    name: "punctuation + non-ASCII",
    // Openverse ANDs the query terms, so a long punctuation-heavy string
    // legitimately returns nothing. This one keeps the terms real and the
    // punctuation noisy: guillemets, umlaut, bang, percent.
    query: "«Käthe Kollwitz»! 100%",
    expect: "results whose titles and tags round-trip non-ASCII intact",
  },
];

function summarise(result: SourceResult): Record<string, unknown> {
  const raw = result.raw as Record<string, unknown>;
  return {
    licence: result.licence,
    title: result.title,
    url: result.url,
    attribution: result.attribution,
    thumbnail: result.thumbnailUrl,
    provider: raw["provider"],
    licenceLabel: `${String(raw["licenceLabel"])} ${String(raw["licenceVersion"])}`,
    tags: Array.isArray(raw["tags"]) ? (raw["tags"] as string[]).slice(0, 5) : [],
  };
}

let exitCode = 0;

for (const testCase of CASES) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`${testCase.name}: ${testCase.query}`);
  console.log(`expect: ${testCase.expect}`);
  console.log("=".repeat(72));

  const startedAt = Date.now();
  let results: SourceResult[];
  try {
    results = await adapter.search(testCase.query);
  } catch (error) {
    // The contract says the adapter never throws, so reaching here is a bug.
    console.error(`FAIL — adapter threw: ${(error as Error).message}`);
    exitCode = 1;
    continue;
  }

  console.log(`${results.length} result(s) in ${Date.now() - startedAt}ms`);

  if (!Array.isArray(results)) {
    console.error("FAIL — search did not return an array");
    exitCode = 1;
    continue;
  }

  const bad = results.filter(
    (result) =>
      result.contract !== "contract-v1" ||
      !result.url.startsWith("https://") ||
      result.title.trim() === "" ||
      (result.snippet !== null && typeof result.snippet !== "string"),
  );
  if (bad.length > 0) {
    console.error(`FAIL — ${bad.length} result(s) violate contract-v1`);
    exitCode = 1;
  }

  // Full objects first, then a compact table for reading at a glance.
  console.dir(results, { depth: null, maxArrayLength: null });
  if (results.length > 0) {
    console.table(results.map(summarise));
    const licences = results.reduce<Record<string, number>>((acc, result) => {
      acc[result.licence] = (acc[result.licence] ?? 0) + 1;
      return acc;
    }, {});
    console.log("licence spread:", licences);
  }
}

console.log(exitCode === 0 ? "\nall cases ok" : "\ncontract problems above");
process.exit(exitCode);
