import { and, desc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import type { SourceResult } from "@/types/source-result";

export interface Idea {
  readonly id: string;
  readonly title: string;
  readonly query: string;
  readonly categoryIds: readonly string[];
  readonly createdAt: string;
}

export interface Pin {
  readonly id: string;
  readonly ideaId: string;
  readonly categoryId: string;
  readonly result: SourceResult;
}

/**
 * Without DATABASE_URL the prototype keeps ideas in process memory, so the
 * demo runs with no infrastructure. Restarting clears them.
 */
const memory = { ideas: [] as Idea[], pins: [] as Pin[] };

export async function createIdea(title: string, query: string, categoryIds: readonly string[]): Promise<Idea> {
  const db = getDb();
  if (!db) {
    const idea: Idea = {
      id: crypto.randomUUID(),
      title,
      query,
      categoryIds: [...categoryIds],
      createdAt: new Date().toISOString(),
    };
    memory.ideas.unshift(idea);
    return idea;
  }

  const [row] = await db
    .insert(schema.ideas)
    .values({ title, query })
    .returning({ id: schema.ideas.id, createdAt: schema.ideas.createdAt });
  if (!row) throw new Error("insert into ideas returned no row");

  if (categoryIds.length > 0) {
    await db
      .insert(schema.ideaCategories)
      .values(categoryIds.map((categoryId) => ({ ideaId: row.id, categoryId })));
  }

  return {
    id: row.id,
    title,
    query,
    categoryIds: [...categoryIds],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listIdeas(): Promise<Idea[]> {
  const db = getDb();
  if (!db) return memory.ideas;

  const rows = await db.select().from(schema.ideas).orderBy(desc(schema.ideas.createdAt));
  const links = await db.select().from(schema.ideaCategories);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    query: row.query,
    categoryIds: links.filter((l) => l.ideaId === row.id).map((l) => l.categoryId),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getIdea(id: string): Promise<Idea | null> {
  const db = getDb();
  if (!db) return memory.ideas.find((idea) => idea.id === id) ?? null;

  const [row] = await db.select().from(schema.ideas).where(eq(schema.ideas.id, id));
  if (!row) return null;

  const links = await db
    .select()
    .from(schema.ideaCategories)
    .where(eq(schema.ideaCategories.ideaId, id));

  return {
    id: row.id,
    title: row.title,
    query: row.query,
    categoryIds: links.map((l) => l.categoryId),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function addCategory(ideaId: string, categoryId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    const index = memory.ideas.findIndex((idea) => idea.id === ideaId);
    const idea = memory.ideas[index];
    if (!idea || idea.categoryIds.includes(categoryId)) return;
    memory.ideas[index] = { ...idea, categoryIds: [...idea.categoryIds, categoryId] };
    return;
  }
  await db
    .insert(schema.ideaCategories)
    .values({ ideaId, categoryId })
    .onConflictDoNothing();
}

export async function pin(
  ideaId: string,
  categoryId: string,
  result: SourceResult,
): Promise<void> {
  const db = getDb();
  if (!db) {
    const exists = memory.pins.some(
      (p) =>
        p.ideaId === ideaId &&
        p.result.sourceId === result.sourceId &&
        p.result.sourceKey === result.sourceKey,
    );
    if (!exists) {
      memory.pins.unshift({ id: crypto.randomUUID(), ideaId, categoryId, result });
    }
    return;
  }
  await db
    .insert(schema.pins)
    .values({
      ideaId,
      categoryId,
      sourceId: result.sourceId,
      sourceKey: result.sourceKey,
      url: result.url,
      result,
    })
    .onConflictDoNothing();
}

export async function unpin(ideaId: string, sourceId: string, sourceKey: string): Promise<void> {
  const db = getDb();
  if (!db) {
    memory.pins = memory.pins.filter(
      (p) =>
        !(
          p.ideaId === ideaId &&
          p.result.sourceId === sourceId &&
          p.result.sourceKey === sourceKey
        ),
    );
    return;
  }
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
  const db = getDb();
  if (!db) return memory.pins.filter((p) => p.ideaId === ideaId);

  const rows = await db
    .select()
    .from(schema.pins)
    .where(eq(schema.pins.ideaId, ideaId))
    .orderBy(desc(schema.pins.createdAt));

  return rows.map((row) => ({
    id: row.id,
    ideaId: row.ideaId,
    categoryId: row.categoryId,
    result: row.result as SourceResult,
  }));
}
