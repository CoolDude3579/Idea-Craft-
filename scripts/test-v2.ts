/**
 * End-to-end test of the V2 multi-user model against the real database.
 *
 *   npm run test:v2
 *
 * Exercises the functions the pages call, not the pages: sessions need a
 * request context, everything that decides who-sees-what does not. Creates two
 * throwaway accounts, shares an idea, pins from both sides, and checks the
 * access rules hold — including that a stranger is refused.
 *
 * Destructive: it clears the app tables first, since the two-account cap means
 * a leftover pair would block registration. Only ever point it at a
 * development database.
 */
import postgres from "postgres";

import { accountCount, authenticate, MAX_ACCOUNTS, register } from "@/lib/accounts";
import {
  canAccess,
  createIdea,
  getDraft,
  getIdea,
  listDrafts,
  listIdeas,
  listMembers,
  listPins,
  pin,
  setDraft,
  unpin,
} from "@/lib/ideas";
import { acceptInvite, createInvite, readInvite } from "@/lib/invites";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  attachIdea,
  createSuperIdea,
  getSuperIdea,
  listIdeasIn,
  listSuperMembers,
  listSuperPins,
  MAX_IDEAS_PER_SUPER,
} from "@/lib/supers";
import { CONTRACT, type SourceResult } from "@/types/source-result";

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function fixture(n: number, kind: SourceResult["kind"] = "paper"): SourceResult {
  return {
    contract: CONTRACT,
    sourceId: "openalex",
    sourceKey: `test-${n}`,
    title: `Test result ${n}`,
    url: `https://example.org/${n}`,
    snippet: "Fixture abstract.",
    kind,
    licence: "CC-BY-4.0",
    licenceUrl: null,
    attribution: "Test, A.",
    thumbnailUrl: null,
    publishedAt: "2024-01-01",
    raw: {},
  };
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run via: npm run test:v2");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
await sql.unsafe(
  `truncate table idea_drafts, invites, super_idea_members, idea_members,
   pins, idea_categories, ideas, super_ideas, sessions, users cascade`,
);
console.log("Cleared app tables.\n");

section("Password hashing");
{
  const stored = await hashPassword("correct horse battery");
  check("hash is iterations.salt.hash", stored.split(".").length === 3);
  check("hash is not the password", !stored.includes("correct horse"));
  check("correct password verifies", await verifyPassword("correct horse battery", stored));
  check("wrong password rejected", !(await verifyPassword("wrong", stored)));
  const again = await hashPassword("correct horse battery");
  check("same password hashes differently (salted)", again !== stored);
}

section("Accounts and the two-account cap");
const a = await register("Ana", "ana@example.com", "password-a1");
const b = await register("Bo", "bo@example.com", "password-b1");
check("first account created", a.ok);
check("second account created", b.ok);
if (!a.ok || !b.ok) {
  console.error("\nCannot continue without two accounts.");
  await sql.end();
  process.exit(1);
}
{
  const third = await register("Cy", "cy@example.com", "password-c1");
  check(`third account refused (cap ${MAX_ACCOUNTS})`, !third.ok);
  check("account count is 2", (await accountCount()) === 2);
  const dupe = await register("Ana again", "ANA@example.com", "password-a1");
  check("duplicate email refused case-insensitively", !dupe.ok);
  const short = await register("Ed", "ed@example.com", "short");
  check("short password refused", !short.ok);

  const good = await authenticate("ana@example.com", "password-a1");
  check("sign-in with correct password", good.ok && good.userId === a.userId);
  const bad = await authenticate("ana@example.com", "password-b1");
  check("sign-in with wrong password refused", !bad.ok);
  const missing = await authenticate("nobody@example.com", "password-a1");
  check(
    "unknown email and wrong password give the same message",
    !missing.ok && !bad.ok && missing.error === bad.error,
  );
}

section("A private idea is private");
const idea = await createIdea(a.userId, "Cancer awareness campaign", "cancer awareness campaign", ["research"]);
check("owner can read it", (await getIdea(a.userId, idea.id)) !== null);
check("the other user cannot", (await getIdea(b.userId, idea.id)) === null);
check("canAccess agrees", !(await canAccess(b.userId, idea.id)));
check("it is not in the other user's list", (await listIdeas(b.userId)).length === 0);
check("owner's draft seeded from the query", (await getDraft(a.userId, idea.id)) === idea.query);

section("Invite links");
let token = "";
{
  const stranger = await createInvite(b.userId, "idea", idea.id);
  check("a non-member cannot mint an invite", stranger === null);

  const minted = await createInvite(a.userId, "idea", idea.id);
  check("owner can mint an invite", typeof minted === "string" && minted.length > 20);
  token = minted ?? "";

  const preview = await readInvite(token);
  check("invite previews the target", preview?.title === idea.title);
  check("invite names the inviter", preview?.invitedBy === "Ana");

  const selfAccept = await acceptInvite(a.userId, token);
  check("owner cannot accept their own invite", !selfAccept.ok);

  const accepted = await acceptInvite(b.userId, token);
  check("invitee accepts", accepted.ok);

  const reuse = await acceptInvite(b.userId, token);
  check("invite is single-use", !reuse.ok);
  check("spent invite no longer previews", (await readInvite(token)) === null);
  check("garbage token refused", (await readInvite("not-a-real-token")) === null);
}

section("Shared idea: one board, separate query boxes");
check("invitee can now read the idea", (await getIdea(b.userId, idea.id)) !== null);
check("it appears in the invitee's list", (await listIdeas(b.userId)).some((i) => i.id === idea.id));
check("two members listed", (await listMembers(idea.id)).length === 2);
check("owner flagged, invitee not", (await listMembers(idea.id)).filter((m) => m.owner).length === 1);
check("invitee's draft seeded from the idea query", (await getDraft(b.userId, idea.id)) === idea.query);
{
  await setDraft(b.userId, idea.id, "cancer awareness poster ideas");
  check("invitee's draft changed", (await getDraft(b.userId, idea.id)) === "cancer awareness poster ideas");
  check("owner's draft untouched", (await getDraft(a.userId, idea.id)) === idea.query);
  check("both drafts visible on the board", (await listDrafts(idea.id)).length === 2);
}

section("Pins from both users land in the one idea");
await pin(a.userId, idea.id, "research", fixture(1));
await pin(b.userId, idea.id, "research", fixture(2));
await pin(b.userId, idea.id, "art", fixture(3, "image"));
{
  const pins = await listPins(idea.id);
  check("three pins on the shared board", pins.length === 3, pins.length);
  check("authorship recorded per pin", new Set(pins.map((p) => p.authorId)).size === 2);
  check("author names resolved", pins.every((p) => p.authorName === "Ana" || p.authorName === "Bo"));

  await pin(a.userId, idea.id, "research", fixture(2));
  check("duplicate result is a no-op", (await listPins(idea.id)).length === 3);
  const stillBo = (await listPins(idea.id)).find((p) => p.result.sourceKey === "test-2");
  check("first pinner keeps authorship", stillBo?.authorName === "Bo");

  await unpin(b.userId, idea.id, "openalex", "test-1");
  check("a collaborator can unpin the owner's pin", (await listPins(idea.id)).length === 2);
}

section("A stranger cannot write to the board");
{
  // No third account exists, so borrow a well-formed but unrelated uuid.
  const nobody = "00000000-0000-4000-8000-000000000000";
  await pin(nobody, idea.id, "research", fixture(99));
  check("pin from a non-member ignored", (await listPins(idea.id)).length === 2);
  await unpin(nobody, idea.id, "openalex", "test-2");
  check("unpin from a non-member ignored", (await listPins(idea.id)).length === 2);
}

section(`Super ideas (max ${MAX_IDEAS_PER_SUPER})`);
const sup = await createSuperIdea(a.userId, "Campus health campaign");
{
  const two = await createIdea(a.userId, "Poster art", "awareness poster art", ["art"]);
  const three = await createIdea(a.userId, "Slogans", "awareness slogans", ["writing"]);
  const four = await createIdea(a.userId, "Extra", "one too many", ["research"]);

  check("first attach", (await attachIdea(a.userId, sup.id, idea.id)).ok);
  check("second attach", (await attachIdea(a.userId, sup.id, two.id)).ok);
  check("third attach", (await attachIdea(a.userId, sup.id, three.id)).ok);
  const overflow = await attachIdea(a.userId, sup.id, four.id);
  check(`fourth refused at ${MAX_IDEAS_PER_SUPER}`, !overflow.ok);
  check("refusal explains why", !overflow.ok && overflow.error.includes(String(MAX_IDEAS_PER_SUPER)));
  check("three ideas filed", (await listIdeasIn(sup.id)).length === 3);
  check("the fourth is still unfiled", (await getIdea(a.userId, four.id))?.superIdeaId === null);
}

section("Sharing a super idea shares the ideas inside it");
{
  const solo = await createIdea(a.userId, "Solo", "not shared at all", ["research"]);
  check("invitee cannot see an unshared idea", (await getIdea(b.userId, solo.id)) === null);
  check("invitee cannot see the super idea yet", (await getSuperIdea(b.userId, sup.id)) === null);

  const superToken = await createInvite(a.userId, "super", sup.id);
  const accepted = await acceptInvite(b.userId, superToken ?? "");
  check("invitee accepts the super invite", accepted.ok);
  check("invitee can read the super idea", (await getSuperIdea(b.userId, sup.id)) !== null);
  check("two members on the super idea", (await listSuperMembers(sup.id)).length === 2);

  const inside = await listIdeasIn(sup.id);
  const reachable = await Promise.all(inside.map((i) => canAccess(b.userId, i.id)));
  check("every idea inside is now reachable", reachable.every(Boolean));
  check("the unshared idea is still not", (await getIdea(b.userId, solo.id)) === null);

  const drafts = await Promise.all(inside.map((i) => getDraft(b.userId, i.id)));
  check("a query box was seeded for each idea inside", drafts.every((d) => d !== null));

  const aggregate = await listSuperPins(sup.id);
  check("aggregate covers all three ideas", aggregate.length === 3);
  const totalPins = aggregate.reduce((sum, entry) => sum + entry.pins.length, 0);
  check("aggregate counts the shared board's pins", totalPins === 2, totalPins);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log("Failed:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
await sql.end();
process.exit(failures.length === 0 ? 0 : 1);
