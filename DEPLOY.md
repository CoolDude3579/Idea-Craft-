# Deploying

Prototype deploy to Vercel + Neon. Nothing here needs a paid plan.

## 1. Database (Neon)

1. Create a Neon project.
2. Copy the **pooled** connection string — the host contains `-pooler`.
   The direct string exhausts connections on serverless.
3. Locally, put it in `.env.local`:

   ```
   DATABASE_URL=postgres://...-pooler...neon.tech/neondb?sslmode=require
   ```

4. Push the schema:

   ```
   npm run db:push
   ```

Without `DATABASE_URL` the app still runs: ideas and pins live in process
memory and vanish between requests.

## 2. Environment variables

Set these in Vercel under Settings -> Environment Variables, for both
**Production** and **Preview**. Preview deploys silently fall back to the
anonymous Openverse pool otherwise, which looks like "the art category is
broken".

| Variable | Needed | Notes |
| --- | --- | --- |
| `DATABASE_URL` | for persistence | Neon **pooled** string |
| `OPENVERSE_CLIENT_ID` | for a live audience | anonymous is 200/day for the whole deployment |
| `OPENVERSE_CLIENT_SECRET` | with the above | |
| `OPENALEX_MAILTO` | polite | any contact address; raises the OpenAlex pool |
| `DEMO_FIXTURES` | fallback only | `1` serves offline placeholder records |

## 3. Deploy

Push to GitHub, import the repo at vercel.com/new, deploy. Framework
detection handles the rest; there is no `vercel.json`.

Verify before presenting:

```
npm run build        # must pass locally first
npm run smoke        # against the deployed URL:
SMOKE_BASE=https://<your-deployment>.vercel.app npm run smoke
```

## Known deployment behaviour

- **`maxDuration = 30` on `/api/search`.** A cold fan-out takes ~15s; Vercel
  defaults functions to 10s and would 504 the art category. If your plan
  rejects 30, lower it and cut the Met's per-object cap (`lib/adapters/met.ts`)
  from 12.
- **gutendex is unreachable from some Indian ISPs.** It may well work from
  Vercel's servers even when it fails on a campus network. Check the deployed
  writing category before assuming the adapter is broken.
- **The rate limiter in `lib/core/http.ts` is per-process**, so it does not
  hold across serverless instances. The 30-minute fan-out cache is the
  mitigation; a shared limiter is post-prototype work.
- **First query after a deploy is slow** — cold function, empty cache. Run the
  demo query once before presenting.
