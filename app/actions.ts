"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { currentUser } from "@/lib/auth";
import { findCategory } from "@/lib/core/categories";
import { requireUser } from "@/lib/guard";
import {
  addCategory,
  createIdea,
  listIdeas,
  pin,
  setDraft,
  unpin,
} from "@/lib/ideas";
import { acceptInvite, createInvite, type InviteKind } from "@/lib/invites";
import { attachIdea, createSuperIdea, detachIdea } from "@/lib/supers";
import { CONTRACT, type SourceResult } from "@/types/source-result";

function requireString(form: FormData, key: string): string {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`missing form field: ${key}`);
  }
  return value;
}

function optionalString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Reuses the idea for this exact query so pinning never forks the board —
 * scoped to what this user can reach, so two people's identical queries do not
 * collide into one another's boards.
 */
async function ideaFor(
  userId: string,
  query: string,
  categoryId: string,
): Promise<string> {
  const existing = (await listIdeas(userId)).find(
    (idea) => idea.query.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  if (existing) {
    if (!existing.categoryIds.includes(categoryId)) {
      await addCategory(userId, existing.id, categoryId);
    }
    return existing.id;
  }
  const created = await createIdea(userId, query.slice(0, 120), query, [categoryId]);
  return created.id;
}

function parseResult(payload: string): SourceResult {
  const parsed = JSON.parse(payload) as SourceResult;
  if (parsed.contract !== CONTRACT) throw new Error("result is not contract-v1");
  return parsed;
}

export async function saveIdea(form: FormData): Promise<void> {
  const user = await requireUser();
  const query = requireString(form, "q");
  const categoryId = requireString(form, "category");
  if (!findCategory(categoryId)) throw new Error(`unknown category: ${categoryId}`);
  const ideaId = await ideaFor(user.id, query, categoryId);
  redirect(`/idea/${ideaId}`);
}

export async function pinResult(form: FormData): Promise<void> {
  const user = await requireUser();
  const query = requireString(form, "q");
  const categoryId = requireString(form, "category");
  const result = parseResult(requireString(form, "result"));
  const ideaId = await ideaFor(user.id, query, categoryId);
  await pin(user.id, ideaId, categoryId, result);
  revalidatePath(`/idea/${ideaId}`);
  revalidatePath(`/c/${categoryId}`);
}

/**
 * Auto-pin on click-through. Never redirects and never throws: it is called
 * fire-and-forget from a link, where there is no error path a user could see.
 */
export async function pinVisited(
  query: string,
  categoryId: string,
  result: SourceResult,
): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  if (result?.contract !== CONTRACT) return;
  if (!findCategory(categoryId)) return;
  if (query.trim() === "") return;

  const ideaId = await ideaFor(user.id, query, categoryId);
  await pin(user.id, ideaId, categoryId, result);
  revalidatePath(`/idea/${ideaId}`);
  revalidatePath(`/c/${categoryId}`);
}

export async function unpinResult(form: FormData): Promise<void> {
  const user = await requireUser();
  const ideaId = requireString(form, "ideaId");
  await unpin(
    user.id,
    ideaId,
    requireString(form, "sourceId"),
    requireString(form, "sourceKey"),
  );
  revalidatePath(`/idea/${ideaId}`);
}

/* -------------------------------------------------------------------------- */
/* Sharing                                                                    */
/* -------------------------------------------------------------------------- */

/** Mints a single-use link and hands it back on the query string, so the page
    can show it without storing anything in client state. */
export async function inviteAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const kind = requireString(form, "kind") as InviteKind;
  const targetId = requireString(form, "targetId");

  const token = await createInvite(user.id, kind, targetId);
  const base = kind === "idea" ? `/idea/${targetId}` : `/super/${targetId}`;
  redirect(token ? `${base}?invite=${token}` : `${base}?error=Could+not+create+an+invite`);
}

export async function acceptInviteAction(form: FormData): Promise<void> {
  const token = requireString(form, "token");
  const user = await requireUser(`/invite/${token}`);

  const result = await acceptInvite(user.id, token);
  if (!result.ok) {
    redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(
    result.kind === "idea" ? `/idea/${result.targetId}` : `/super/${result.targetId}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Super ideas                                                                */
/* -------------------------------------------------------------------------- */

export async function createSuperIdeaAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const title = requireString(form, "title");
  const created = await createSuperIdea(user.id, title.slice(0, 120));
  redirect(`/super/${created.id}`);
}

export async function attachIdeaAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const superIdeaId = requireString(form, "superIdeaId");
  const ideaId = requireString(form, "ideaId");

  const result = await attachIdea(user.id, superIdeaId, ideaId);
  redirect(
    result.ok
      ? `/super/${superIdeaId}`
      : `/super/${superIdeaId}?error=${encodeURIComponent(result.error)}`,
  );
}

export async function detachIdeaAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const superIdeaId = requireString(form, "superIdeaId");
  await detachIdea(user.id, requireString(form, "ideaId"));
  redirect(`/super/${superIdeaId}`);
}

/* -------------------------------------------------------------------------- */
/* Per-user query boxes                                                       */
/* -------------------------------------------------------------------------- */

/** Each member's own prompt for a shared idea. Saving one never touches
    anybody else's. */
export async function saveDraftAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const ideaId = requireString(form, "ideaId");
  const query = optionalString(form, "q");
  await setDraft(user.id, ideaId, query);
  revalidatePath(`/idea/${ideaId}`);
}
