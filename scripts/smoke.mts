// Smoke test against a running server: npm run dev, then npm run smoke.
// Deliberately talks to /api/search rather than importing the adapters, so
// the script needs no bundler and exercises the route the frontend uses.
import { isSpdx } from "../types/source-result.ts";
import type { SourceResult } from "../types/source-result.ts";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const QUERY = process.argv[2] ?? "cancer awareness campaign";
const CATEGORIES = ["research", "art", "writing"] as const;

interface Payload {
  sources: { sourceId: string; label: string; count: number; ms: number; ok: boolean; error: string | null }[];
  stats: { fetched: number; afterDedupe: number; ms: number };
  results: (SourceResult & { score: number })[];
}

function check(result: SourceResult & { score: number }): string[] {
  const problems: string[] = [];
  if (result.contract !== "contract-v1") problems.push("contract");
  if (!result.url.startsWith("https://")) problems.push(`url ${result.url}`);
  if (!isSpdx(result.licence)) problems.push(`licence ${result.licence}`);
  if (!result.title.trim()) problems.push("empty title");
  if (!result.sourceId || !result.sourceKey) problems.push("missing source key");
  if (result.snippet !== null && typeof result.snippet !== "string") {
    problems.push("snippet type");
  }
  return problems.map((problem) => `${result.sourceId}: ${problem}`);
}

let failures = 0;
let down = 0;

{
  const response = await fetch(`${BASE}/api/licence-probe`);
  const payload = (await response.json()) as {
    total: number;
    failures: { provider: string; got: string; want: string }[];
  };
  failures += payload.failures.length;
  console.log(
    `licence mapper — ${payload.total - payload.failures.length}/${payload.total} verified provider spellings`,
  );
  for (const f of payload.failures) {
    console.error(`  ! ${f.provider}: got ${f.got}, want ${f.want}`);
  }
}

for (const category of CATEGORIES) {
  const url = `${BASE}/api/search?q=${encodeURIComponent(QUERY)}&category=${category}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`${category}: HTTP ${response.status}`);
    failures += 1;
    continue;
  }

  const payload = (await response.json()) as Payload;
  const problems = payload.results.flatMap(check);
  failures += problems.length;

  console.log(`\n${category} — ${payload.results.length} ranked, ${payload.stats.ms}ms`);
  for (const source of payload.sources) {
    if (!source.ok) down += 1;
    console.log(
      `  ${source.sourceId.padEnd(10)} ${source.ok ? String(source.count).padStart(3) : " ✗ "} ` +
        `${String(source.ms).padStart(5)}ms` +
        (source.error ? `  — ${source.error}` : ""),
    );
  }
  console.log(
    `  fetched ${payload.stats.fetched}, after dedupe ${payload.stats.afterDedupe}`,
  );
  for (const problem of problems) console.error(`  ! ${problem}`);
}

console.log(failures === 0 ? "\ncontract-v1 ok" : `\n${failures} contract violations`);
// A source that failed is not a contract violation, but it is not a pass
// either - it used to be reported as a healthy zero.
if (down > 0) console.error(`${down} source${down === 1 ? "" : "s"} failed`);
process.exit(failures === 0 && down === 0 ? 0 : 1);
