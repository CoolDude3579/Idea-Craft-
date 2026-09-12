// Drops every app table so `npm run db:push` can create them fresh.
//
// Why this exists: drizzle-kit push mis-diffs a text primary key and emits
// "ALTER COLUMN key DROP NOT NULL" on search_cache, which Postgres refuses
// (42P16). With no tables present push only issues CREATE TABLE, so the bug
// has nothing to trigger on.
//
//   node --env-file=.env scripts/reset-db.mjs             # list tables only
//   node --env-file=.env scripts/reset-db.mjs --truncate  # empty them, keep schema
//   node --env-file=.env scripts/reset-db.mjs --yes       # drop them entirely
//
// Destructive, so it does nothing without --truncate or --yes. Use
// --truncate after `npm run test:v2`, which leaves two accounts behind and so
// fills the two-account cap.

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env scripts/reset-db.mjs");
  process.exit(1);
}

// Child tables first; cascade covers the rest regardless.
const TABLES = [
  "idea_drafts",
  "invites",
  "super_idea_members",
  "idea_members",
  "pins",
  "idea_categories",
  "ideas",
  "super_ideas",
  "sessions",
  "users",
  "search_cache",
];

const sql = postgres(url, { prepare: false, max: 1 });

async function listTables() {
  const rows = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `;
  return rows.map((row) => row.table_name);
}

try {
  if (process.argv.includes("--truncate")) {
    // search_cache is left alone: it is derived data and costs a refetch.
    const app = TABLES.filter((table) => table !== "search_cache");
    await sql.unsafe(`truncate table ${app.join(", ")} cascade`);
    console.log(`Emptied ${app.length} tables. Schema intact — sign up afresh.`);
  } else if (process.argv.includes("--yes")) {
    console.log("Dropping:", TABLES.join(", "));
    await sql.unsafe(`drop table if exists ${TABLES.join(", ")} cascade`);
    console.log("Dropped. Now run: npm run db:push");
  } else {
    console.log("Read-only. Pass --truncate to empty, or --yes to drop.\n");
  }

  const tables = await listTables();
  console.log(`\nTables in public (${tables.length}):`);
  console.log(tables.length ? tables.map((t) => `  ${t}`).join("\n") : "  (none)");
} catch (error) {
  console.error("Failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
