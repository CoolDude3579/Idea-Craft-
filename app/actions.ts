"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { findCategory } from "@/lib/core/categories";
import { addCategory, createIdea, listIdeas, pin, unpin } from "@/lib/ideas";
import { CONTRACT, type SourceResult } from "@/types/source-result";

function requireString(form: FormData, key: string): string {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`missing form field: ${key}`);
  }
  return value;
}

/** Reuses the idea for this exact query so pinning never forks the board. */
async function ideaFor(query: string, categoryId: string): Promise<string> {
  const existing = (await listIdeas()).find(
    (idea) => idea.query.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  if (existing) {
    if (!existing.categoryIds.includes(categoryId)) {
      await addCategory(existing.id, categoryId);
    }
    return existing.id;
  }
  const created = await createIdea(query.slice(0, 120), query, [categoryId]);
  return created.id;
}

function parseResult(payload: string): SourceResult {
  const parsed = JSON.parse(payload) as SourceResult;
  if (parsed.contract !== CONTRACT) throw new Error("result is not contract-v1");
  return parsed;
}

export async function saveIdea(form: FormData): Promise<void> {
  const query = requireString(form, "q");
  const categoryId = requireString(form, "category");
  if (!findCategory(categoryId)) throw new Error(`unknown category: ${categoryId}`);
  const ideaId = await ideaFor(query, categoryId);
  redirect(`/idea/${ideaId}`);
}

/**
 * Auto-pin on click-through, called from VisitLink. Never throws: a background
 * call has no user-visible failure path, and a bad payload should cost the user
 * nothing — the explicit Pin button remains the deliberate route.
 */
export async function pinVisited(
  query: string,
  categoryId: string,
  result: SourceResult,
): Promise<void> {
  if (result?.contract !== CONTRACT) return;
  if (!findCategory(categoryId)) return;
  if (query.trim() === "") return;

  const ideaId = await ideaFor(query, categoryId);
  await pin(ideaId, categoryId, result);
  revalidatePath(`/idea/${ideaId}`);
  revalidatePath(`/c/${categoryId}`);
}

export async function pinResult(form: FormData): Promise<void> {
  const query = requireString(form, "q");
  const categoryId = requireString(form, "category");
  const result = parseResult(requireString(form, "result"));
  const ideaId = await ideaFor(query, categoryId);
  await pin(ideaId, categoryId, result);
  revalidatePath(`/idea/${ideaId}`);
  revalidatePath(`/c/${categoryId}`);
}

export async function unpinResult(form: FormData): Promise<void> {
  const ideaId = requireString(form, "ideaId");
  await unpin(ideaId, requireString(form, "sourceId"), requireString(form, "sourceKey"));
  revalidatePath(`/idea/${ideaId}`);
}
