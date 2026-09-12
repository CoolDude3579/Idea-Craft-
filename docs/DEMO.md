# DEMO.md — what the prototype does, and nothing more

Demo query: **"a cancer awareness campaign for my campus"**

## The three minutes

1. `/` — type the idea. Keywords are extracted; four category cards appear,
   Policy visibly marked `deferred`.
2. `/c/research?q=…` — fan-out to OpenAlex + Europe PMC. Point at the source
   bar: per-source counts, timings, duplicates collapsed. One row says *also
   in Europe PMC* — same DOI, two providers, one row, freer licence kept.
   One row reads **CC BY, version unstated** — the provider named the family
   and no version, so the contract says `UNKNOWN` and the badge says why.
3. `/c/art?q=…` → **Posters & designs** — Openverse + Commons + Art
   Institute. Every row carries an SPDX badge and its reuse conditions;
   CC0 rows sort above NC ones because licence freedom is a ranking signal.
4. `/c/writing?q=…` → **Slogans & copy** — Gutenberg rows plus a Datamuse
   phrase panel. Say out loud that the panel is vocabulary, not sources:
   nothing in it is licensed, ranked or pinnable.
5. Pin two or three rows, then `Save as an idea`.
6. `/idea/<id>` — one idea holding research, posters and slogans side by side.
7. `/api/search?q=…&category=research` — the same pipeline as JSON.

## Sources, each verified by a real call

| id | endpoint | licence field | notes from verification |
|---|---|---|---|
| `openalex` | `/works?search=&per_page=20&mailto=` | `best_oa_location.license`, else `license_id` | **often `null` even for gold OA**, never version-qualified. `select=` trims the payload. 100k credits/day, a 20-row list query costs 10. |
| `europepmc` | `/europepmc/webservices/rest/search?resultType=core` | `license` | spelled lowercase with a space: `"cc by"`, `"cc by-nc"`. No version. `abstractText` carries `<h4>` markup. Deep link from `fullTextUrlList` where `availabilityCode = OA`. |
| `openverse` | `/v1/images/?q=&page_size=20` | `license` + `license_version` | **anonymous is usable**: headers report 20/min and 200/day, not the "unusable" the brief assumed. Token still raises it. Data is largely Flickr **CC 2.0**, which is why the SPDX enum needed versions. |
| `commons` | `w/api.php` generator=search, ns 6 | `extmetadata.License` | `"cc-by-sa-4.0"`, `"cc0"`, `"pd"`. Needs a real user agent. |
| `artic` | `/api/v1/artworks/search?fields=…` | `is_public_domain` | `fields` **does** work on the search endpoint, so this is one call, no per-object fan-out. `image_id` is `null` on plenty of records, public-domain ones included. |
| `met` | `/search` then `/objects/{id}` | `isPublicDomain` | genuinely one request per object; capped at 12 per search. |
| `gutendex` | `/books?search=&copyright=false` | `copyright` | now returns `summaries`, which Gutendex labels *automatically generated* — so it is kept in `raw.providerSummary` and never shown as a snippet. `formats["image/jpeg"]` gives a cover thumbnail. |
| `datamuse` | `/words?ml=`, `rel_jjb`, `rel_rhy` | n/a | returns words, not documents: rendered as a phrase panel, never a `SourceResult`. Multi-word `ml=` works. |
| policy | — | — | deferred. Placeholder card only; Federal Register API first when it resumes. |

## Scope of the prototype

In:

- Seven adapters plus the Datamuse phrase panel.
- Three live categories with subcategories that steer the provider query,
  and one deferred placeholder category.
- Normalise → dedupe (DOI, canonical URL, title fingerprint) → licence tag →
  rerank (keyword overlap, licence freedom, recency) → source interleave.
- Ideas and pins, persisted to Postgres. The V1 process-memory fallback is
  gone: with accounts it is not a degraded mode but a wrong one, since each
  instance would keep its own users and an invite would land on an empty
  board. `DATABASE_URL` is required and says so when missing.
- Fan-out cache on `searchCache`, keyed by category + subcategory + steered
  query, 6h TTL, Postgres when `DATABASE_URL` is set and process memory when it
  is not. A hit makes no provider requests at all: measured 4.1s to 0.75s on
  the art category. Raw provider results are cached, not the ranked page, so a
  relevance change takes effect immediately rather than waiting out the TTL.
  An expired entry is still served, labelled stale in the source bar, when the
  live fan-out comes back empty — a dead venue network shows the last good
  answer instead of nothing. Outages are never cached.
- JSON API at `/api/search`.
- Accounts (V2): signup, login, sessions. PBKDF2-HMAC-SHA512 at 210k iterations
  through Web Crypto, opaque session tokens in Postgres, no new dependencies.
  Capped at two accounts in code, not in the schema.
- Sharing (V2): single-use invite links, 7-day expiry, for an idea or a super
  idea. Access is "owner, or member, or member of the parent super idea", so
  sharing a super idea shares the ideas inside it without copying a row.
- Collaboration (V2) is shared storage with split input: `idea_drafts` holds
  each member's own prompt, seeded from the idea's query when they accept, and
  everyone's pins land in the one shared idea. Nothing is synchronised, so
  nothing can conflict. `pins.authorId` records who kept what, and the export
  prints it on shared boards.
- Super ideas (V2): up to three ideas grouped, with an aggregate export.
- `npm run test:v2` — 61 assertions over the multi-user model against a real
  database: hashing, the account cap, account enumeration, private ideas,
  invite single-use, separate query boxes, pin authorship, a stranger's writes
  being ignored, and super-idea access inheritance.
- `npm run db:clean` empties the app tables (test:v2 leaves two accounts, which
  fills the cap); `scripts/reset-db.mjs --yes` drops them, for when
  `drizzle-kit push` mis-diffs a text primary key.
- PDF export of an idea's pinned sources at `/idea/<id>/print`, via the
  browser's own print engine — no dependency and nothing for the serverless
  runtime to bundle. Includes a credits block for the licences that require
  attribution.
- `npm run smoke` — the licence mapper over every verified provider spelling,
  then contract-v1 assertions over the live fan-out for all three categories.
- `DEMO_FIXTURES=1` — offline placeholder records so a dead venue network
  cannot kill the demo. Rows are labelled `fixture` in the UI; the phrase
  panel is off in this mode.

Out, by decision:

- policy APIs, news, real-time collaboration (shared cursors, live sync)
- hosting or caching provider content — we deep-link only
- generated or summarised text: `snippet` is provider-supplied or null
- server-side document generation: the PDF export is the browser's print
  engine, so there is no headless Chromium in the deployment
- tests beyond the smoke script

## Running it

```
npm install
cp .env.example .env.local          # every value is optional
npm run dev                          # http://localhost:3000
DEMO_FIXTURES=1 npm run dev          # offline
npm run smoke                        # needs a server running
npm run typecheck
```

With `DATABASE_URL` pointing at Neon: `npm run db:push`.

## Known limits to say out loud

- OpenAlex and Europe PMC name the licence family without a version, so many
  research rows read *version unstated* and carry `UNKNOWN` in the contract.
  That is deliberate: 1.0 and 2.5 exist and differ, and guessing 4.0 on a
  reuse-rights surface would be worse than saying so.
- Openverse on the anonymous pool is 200 requests/day. Set
  `OPENVERSE_CLIENT_ID`/`SECRET` before a live audience.
- The Met needs one request per object, capped at 12 per search.
- Title-fingerprint dedupe is deliberately conservative; near-duplicate
  images from different providers will both appear.
- `/api/licence-probe` exists for the smoke script only. It is not part of
  the demo and has no UI.
