import { and, desc, eq, isNotNull, or } from "drizzle-orm";

import { getDb, schema } from "@/db";

import { countIdeasIn, listPins, type Idea, type Pin } from "./ideas";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is required for super ideas.");
  return db;
}

/** A project too big for one idea's categories. Three ideas at most, by
    deliberate constraint rather than any technical limit. */
export const MAX_IDEAS_PER_SUPER = 3;

export interface SuperIdea {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly createdAt: string;
}

function visibleTo(userId: string) {
  return or(
    eq(schema.superIdeas.ownerId, userId),
    isNotNull(schema.superIdeaMembers.userId),
  );
}

export async function listSuperIdeas(userId: string): Promise<SuperIdea[]> {
  const db = requireDb();
  const rows = await db
    .selectDistinct({
      id: schema.superIdeas.id,
      ownerId: schema.superIdeas.ownerId,
      title: schema.superIdeas.title,
      createdAt: schema.superIdeas.createdAt,
    })
    .from(schema.superIdeas)
    .leftJoin(
      schema.superIdeaMembers,
      and(
        eq(schema.superIdeaMembers.superIdeaId, schema.superIdeas.id),
        eq(schema.superIdeaMembers.userId, userId),
      ),
    )
    .where(visibleTo(userId))
    .orderBy(desc(schema.superIdeas.createdAt));

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function getSuperIdea(
  userId: string,
  id: string,
): Promise<SuperIdea | null> {
  const db = requireDb();
  const [row] = await db
    .selectDistinct({
      id: schema.superIdeas.id,
      ownerId: schema.superIdeas.ownerId,
      title: schema.superIdeas.title,
      createdAt: schema.superIdeas.createdAt,
    })
    .from(schema.superIdeas)
    .leftJoin(
      schema.superIdeaMembers,
      and(
        eq(schema.superIdeaMembers.superIdeaId, schema.superIdeas.id),
        eq(schema.superIdeaMembers.userId, userId),
      ),
    )
    .where(and(eq(schema.superIdeas.id, id), visibleTo(userId)));

  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function createSuperIdea(
  userId: string,
  title: string,
): Promise<SuperIdea> {
  const db = requireDb();
  const [row] = await db
    .insert(schema.superIdeas)
    .values({ ownerId: userId, title })
    .returning({ id: schema.superIdeas.id, createdAt: schema.superIdeas.createdAt });
  if (!row) throw new Error("insert into super_ideas returned no row");
  return {
    id: row.id,
    ownerId: userId,
    title,
    createdAt: row.createdAt.toISOString(),
  };
}

export type AttachResult = { ok: true } | { ok: false; error: string };

/**
 * Files an idea under a super idea. Refuses rather than silently dropping: a
 * cap that fails quietly is a cap the user discovers by wondering where their
 * idea went.
 */
export async function attachIdea(
  userId: string,
  superIdeaId: string,
  ideaId: string,
): Promise<AttachResult> {
  const db = requireDb();

  if (!(await getSuperIdea(userId, superIdeaId))) {
    return { ok: false, error: "That super idea is not yours to change." };
  }

  const [idea] = await db
    .select({ ownerId: schema.ideas.ownerId, superIdeaId: schema.ideas.superIdeaId })
    .from(schema.ideas)
    .where(eq(schema.ideas.id, ideaId));
  if (!idea) return { ok: false, error: "No such idea." };
  if (idea.ownerId !== userId) {
    return { ok: false, error: "Only the idea's owner can file it under a super idea." };
  }
  if (idea.superIdeaId === superIdeaId) return { ok: true };
  if (idea.superIdeaId) {
    return { ok: false, error: "That idea already belongs to another super idea." };
  }
  if ((await countIdeasIn(superIdeaId)) >= MAX_IDEAS_PER_SUPER) {
    return {
      ok: false,
      error: `A super idea holds at most ${MAX_IDEAS_PER_SUPER} ideas.`,
    };
  }

  await db
    .update(schema.ideas)
    .set({ superIdeaId })
    .where(eq(schema.ideas.id, ideaId));
  return { ok: true };
}

export async function detachIdea(userId: string, ideaId: string): Promise<void> {
  const db = requireDb();
  await db
    .update(schema.ideas)
    .set({ superIdeaId: null })
    .where(and(eq(schema.ideas.id, ideaId), eq(schema.ideas.ownerId, userId)));
}

/** The ideas filed under a super idea, oldest first so the order is stable. */
export async function listIdeasIn(superIdeaId: string): Promise<Idea[]> {
  const db = requireDb();
  const rows = await db
    .select({
      id: schema.ideas.id,
      ownerId: schema.ideas.ownerId,
      superIdeaId: schema.ideas.superIdeaId,
      title: schema.ideas.title,
      query: schema.ideas.query,
      createdAt: schema.ideas.createdAt,
    })
    .from(schema.ideas)
    .where(eq(schema.ideas.superIdeaId, superIdeaId))
    .orderBy(schema.ideas.createdAt);

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

export async function addSuperMember(
  superIdeaId: string,
  userId: string,
): Promise<void> {
  const db = requireDb();
  await db
    .insert(schema.superIdeaMembers)
    .values({ superIdeaId, userId })
    .onConflictDoNothing();
}

export async function listSuperMembers(
  superIdeaId: string,
): Promise<{ id: string; name: string; owner: boolean }[]> {
  const db = requireDb();

  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.superIdeas)
    .innerJoin(schema.users, eq(schema.users.id, schema.superIdeas.ownerId))
    .where(eq(schema.superIdeas.id, superIdeaId));

  const collaborators = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.superIdeaMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.superIdeaMembers.userId))
    .where(eq(schema.superIdeaMembers.superIdeaId, superIdeaId));

  return [
    ...(owner ? [{ ...owner, owner: true }] : []),
    ...collaborators.map((row) => ({ ...row, owner: false })),
  ];
}

/** Pins across every idea in a super idea, for the aggregate view and export. */
export async function listSuperPins(
  superIdeaId: string,
): Promise<{ idea: Idea; pins: Pin[] }[]> {
  const ideas = await listIdeasIn(superIdeaId);
  return Promise.all(
    ideas.map(async (idea) => ({ idea, pins: await listPins(idea.id) })),
  );
}
