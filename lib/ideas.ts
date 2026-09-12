import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";
import type { SourceResult } from "@/types/source-result";

/**
 * V2 drops the process-memory fallback that V1 used when DATABASE_URL was
 * unset. With accounts and sharing, memory is not a degraded mode but a wrong
 * one: each server instance would keep its own users and ideas, so an invite
 * link would land on an empty board and two people would never see the same
 * thing. Failing loudly beats that.
 */
function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error(
      "DATABASE_URL is required: ideas, accounts and sharing are all stored " +
        "in Postgres, and process memory is not shared between instances.",
    );
  }
  return db;
}

export interface Idea {
  readonly id: string;
  readonly ownerId: string;
  readonly superIdeaId: string | null;
  readonly title: string;
  readonly query: string;
  readonly categoryIds: readonly string[];
  readonly createdAt: string;
}

export interface Pin {
  readonly id: string;
  readonly ideaId: string;
  readonly categoryId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly result: SourceResult;
}

export interface Member {
  readonly id: string;
  readonly name: string;
  readonly owner: boolean;
}

/**
 * One access rule for the whole app: you reach an idea if you own it, if it was
 * shared with you, or if you are on its parent super idea. That last clause is
 * what makes sharing a super idea share the ideas inside it without copying a
 * single row.
 */
function visibleTo(userId: string) {
  return or(
    eq(schema.ideas.ownerId, userId),
    isNotNull(schema.ideaMembers.userId),
    eq(schema.superIdeas.ownerId, userId),
    isNotNull(schema.superIdeaMembers.userId),
  );
}

/** Ideas the user owns or can see, newest first. */
export async function listIdeas(userId: string): Promise<Idea[]> {
  const db = requireDb();

  const rows = await db
    .selectDistinct({
      id: schema.ideas.id,
      ownerId: schema.ideas.ownerId,
      superIdeaId: schema.ideas.superIdeaId,
      title: schema.ideas.title,
      query: schema.ideas.query,
      createdAt: schema.ideas.createdAt,
    })
    .from(schema.ideas)
    .leftJoin(
      schema.ideaMembers,
      and(
        eq(schema.ideaMembers.ideaId, schema.ideas.id),
        eq(schema.ideaMembers.userId, userId),
      ),
    )
    .leftJoin(schema.superIdeas, eq(schema.superIdeas.id, schema.ideas.superIdeaId))
    .leftJoin(
      schema.superIdeaMembers,
      and(
        eq(schema.superIdeaMembers.superIdeaId, schema.superIdeas.id),
        eq(schema.superIdeaMembers.userId, userId),
      ),
    )
    .where(visibleTo(userId))
    .orderBy(desc(schema.ideas.createdAt));

  if (rows.length === 0) return [];

  const links = await db.select().from(schema.ideaCategories);

  return rows.map((row) => ({
    id: row.id,
    ownerId: row.ownerId,
    superIdeaId: row.superIdeaId,
    title: row.title,
    query: row.query,
    categoryIds: links.filter((l) => l.ideaId === row.id).map((l) => l.categoryId),
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Null when the idea does not exist OR the user may not see it — the caller
    cannot tell the difference, which is the point. */
export async function getIdea(userId: string, id: string): Promise<Idea | null> {
  const db = requireDb();

  const [row] = await db
    .selectDistinct({
      id: schema.ideas.id,
      ownerId: schema.ideas.ownerId,
      superIdeaId: schema.ideas.superIdeaId,
      title: schema.ideas.title,
      query: schema.ideas.query,
      createdAt: schema.ideas.createdAt,
    })
    .from(schema.ideas)
    .leftJoin(
      schema.ideaMembers,
      and(
        eq(schema.ideaMembers.ideaId, schema.ideas.id),
        eq(schema.ideaMembers.userId, userId),
      ),
    )
    .leftJoin(schema.superIdeas, eq(schema.superIdeas.id, schema.ideas.superIdeaId))
    .leftJoin(
      schema.superIdeaMembers,
      and(
        eq(schema.superIdeaMembers.superIdeaId, schema.superIdeas.id),
        eq(schema.superIdeaMembers.userId, userId),
      ),
    )
    .where(and(eq(schema.ideas.id, id), visibleTo(userId)));

  if (!row) return null;

  const links = await db
    .select()
    .from(schema.ideaCategories)
    .where(eq(schema.ideaCategories.ideaId, id));

  return {
    id: row.id,
    ownerId: row.ownerId,
    superIdeaId: row.superIdeaId,
    title: row.title,
    query: row.query,
    categoryIds: links.map((l) => l.categoryId),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function canAccess(userId: string, ideaId: string): Promise<boolean> {
  return (await getIdea(userId, ideaId)) !== null;
}

export async function createIdea(
  userId: string,
  title: string,
  query: string,
  categoryIds: readonly string[],
  superIdeaId?: string | null,
): Promise<Idea> {
  const db = requireDb();

  const [row] = await db
    .insert(schema.ideas)
    .values({ ownerId: userId, title, query, superIdeaId: superIdeaId ?? null })
    .returning({ id: schema.ideas.id, createdAt: schema.ideas.createdAt });
  if (!row) throw new Error("insert into ideas returned no row");

  if (categoryIds.length > 0) {
    await db
      .insert(schema.ideaCategories)
      .values(categoryIds.map((categoryId) => ({ ideaId: row.id, categoryId })));
  }

  // The author's own draft starts as the idea's query; collaborators get
  // theirs when the invite is accepted.
  await setDraft(userId, row.id, query);

  return {
    id: row.id,
    ownerId: userId,
    superIdeaId: superIdeaId ?? null,
    title,
    query,
    categoryIds: [...categoryIds],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The idea this user already has for this exact query, if any — the read-only
 * half of what ideaFor() does when pinning. A search page needs it to know
 * which rows are already kept, so the row can say "Pinned" instead of
 * offering to pin something twice.
 */
export async function findIdeaByQuery(
  userId: string,
  query: string,
): Promise<Idea | null> {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") return null;
  return (
    (await listIdeas(userId)).find(
      (idea) => idea.query.trim().toLowerCase() === wanted,
    ) ?? null
  );
}

/** Keys of the results already kept on an idea, as `sourceId:sourceKey`. */
export async function pinnedKeys(ideaId: string): Promise<Set<string>> {
  const pins = await listPins(ideaId);
  return new Set(pins.map((p) => `${p.result.sourceId}:${p.result.sourceKey}`));
}

export async function addCategory(
  userId: string,
  ideaId: string,
  categoryId: string,
): Promise<void> {
  const db = requireDb();
  if (!(await canAccess(userId, ideaId))) return;
  await db
    .insert(schema.ideaCategories)
    .values({ ideaId, categoryId })
    .onConflictDoNothing();
}

export async function pin(
  userId: string,
  ideaId: string,
  categoryId: string,
  result: SourceResult,
): Promise<void> {
  const db = requireDb();
  if (!(await canAccess(userId, ideaId))) return;

  await db
    .insert(schema.pins)
    .values({
      ideaId,
      authorId: userId,
      categoryId,
      sourceId: result.sourceId,
      sourceKey: result.sourceKey,
      url: result.url,
      result,
    })
    .onConflictDoNothing();
}

export async function unpin(
  userId: string,
  ideaId: string,
  sourceId: string,
  sourceKey: string,
): Promise<void> {
  const db = requireDb();
  if (!(await canAccess(userId, ideaId))) return;

  // Any collaborator may unpin: a shared board where only the pinner can
  // remove a row is a board nobody can tidy.
  await db
    .delete(schema.pins)
    .where(
      and(
        eq(schema.pins.ideaId, ideaId),
        eq(schema.pins.sourceId, sourceId),
        eq(schema.pins.sourceKey, sourceKey),
      ),
    );
}

export async function listPins(ideaId: string): Promise<Pin[]> {
  const db = requireDb();

  const rows = await db
    .select({
      id: schema.pins.id,
      ideaId: schema.pins.ideaId,
      categoryId: schema.pins.categoryId,
      authorId: schema.pins.authorId,
      authorName: schema.users.name,
      result: schema.pins.result,
    })
    .from(schema.pins)
    .innerJoin(schema.users, eq(schema.users.id, schema.pins.authorId))
    .where(eq(schema.pins.ideaId, ideaId))
    .orderBy(desc(schema.pins.createdAt));

  return rows.map((row) => ({
    id: row.id,
    ideaId: row.ideaId,
    categoryId: row.categoryId,
    authorId: row.authorId,
    authorName: row.authorName,
    result: row.result as SourceResult,
  }));
}

/** Owner first, then collaborators. */
export async function listMembers(ideaId: string): Promise<Member[]> {
  const db = requireDb();

  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.ideas)
    .innerJoin(schema.users, eq(schema.users.id, schema.ideas.ownerId))
    .where(eq(schema.ideas.id, ideaId));

  const collaborators = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.ideaMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.ideaMembers.userId))
    .where(eq(schema.ideaMembers.ideaId, ideaId));

  return [
    ...(owner ? [{ ...owner, owner: true }] : []),
    ...collaborators.map((row) => ({ ...row, owner: false })),
  ];
}

export async function addMember(ideaId: string, userId: string): Promise<void> {
  const db = requireDb();
  await db
    .insert(schema.ideaMembers)
    .values({ ideaId, userId })
    .onConflictDoNothing();
}

/* -------------------------------------------------------------------------- */
/* Per-user query boxes                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The collaboration model in two functions. Each member holds their own copy
 * of the prompt for a shared idea and edits it freely; the pins they produce
 * land in the one shared idea. Nothing is synchronised, so nothing can
 * conflict.
 */
export async function getDraft(userId: string, ideaId: string): Promise<string | null> {
  const db = requireDb();
  const [row] = await db
    .select({ query: schema.ideaDrafts.query })
    .from(schema.ideaDrafts)
    .where(
      and(
        eq(schema.ideaDrafts.ideaId, ideaId),
        eq(schema.ideaDrafts.userId, userId),
      ),
    );
  return row?.query ?? null;
}

export async function setDraft(
  userId: string,
  ideaId: string,
  query: string,
): Promise<void> {
  const db = requireDb();
  await db
    .insert(schema.ideaDrafts)
    .values({ ideaId, userId, query, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.ideaDrafts.ideaId, schema.ideaDrafts.userId],
      set: { query, updatedAt: new Date() },
    });
}

/** Everyone's current query box for a shared idea, so the board can show what
    the other person is working on without any live connection. */
export async function listDrafts(
  ideaId: string,
): Promise<{ userId: string; name: string; query: string; updatedAt: string }[]> {
  const db = requireDb();
  const rows = await db
    .select({
      userId: schema.ideaDrafts.userId,
      name: schema.users.name,
      query: schema.ideaDrafts.query,
      updatedAt: schema.ideaDrafts.updatedAt,
    })
    .from(schema.ideaDrafts)
    .innerJoin(schema.users, eq(schema.users.id, schema.ideaDrafts.userId))
    .where(eq(schema.ideaDrafts.ideaId, ideaId))
    .orderBy(desc(schema.ideaDrafts.updatedAt));

  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

export async function countIdeasIn(superIdeaId: string): Promise<number> {
  const db = requireDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.ideas)
    .where(eq(schema.ideas.superIdeaId, superIdeaId));
  return row?.count ?? 0;
}
