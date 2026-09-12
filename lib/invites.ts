import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb, schema } from "@/db";

import { addMember, getIdea, setDraft } from "./ideas";
import { newToken } from "./password";
import { addSuperMember, getSuperIdea, listIdeasIn } from "./supers";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is required for invites.");
  return db;
}

export type InviteKind = "idea" | "super";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Single-use and expiring. A share link that never dies and admits anyone who
 * finds it is not a feature, and it is the first thing anyone looks at.
 */
export async function createInvite(
  userId: string,
  kind: InviteKind,
  targetId: string,
): Promise<string | null> {
  const db = requireDb();

  // Only someone who can already reach the target may hand it out.
  const allowed =
    kind === "idea"
      ? (await getIdea(userId, targetId)) !== null
      : (await getSuperIdea(userId, targetId)) !== null;
  if (!allowed) return null;

  const token = newToken(24);
  await db.insert(schema.invites).values({
    token,
    kind,
    targetId,
    createdBy: userId,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return token;
}

export interface InvitePreview {
  readonly kind: InviteKind;
  readonly targetId: string;
  readonly title: string;
  readonly invitedBy: string;
}

/** Unspent, unexpired invites only. */
export async function readInvite(token: string): Promise<InvitePreview | null> {
  const db = requireDb();

  const [row] = await db
    .select({
      kind: schema.invites.kind,
      targetId: schema.invites.targetId,
      invitedBy: schema.users.name,
    })
    .from(schema.invites)
    .innerJoin(schema.users, eq(schema.users.id, schema.invites.createdBy))
    .where(
      and(
        eq(schema.invites.token, token),
        isNull(schema.invites.acceptedBy),
        gt(schema.invites.expiresAt, new Date()),
      ),
    );
  if (!row) return null;

  const kind = row.kind as InviteKind;

  // Read the title as the inviter, not the visitor: the visitor has no access
  // yet, which is the whole reason they are here.
  const [target] =
    kind === "idea"
      ? await db
          .select({ title: schema.ideas.title })
          .from(schema.ideas)
          .where(eq(schema.ideas.id, row.targetId))
      : await db
          .select({ title: schema.superIdeas.title })
          .from(schema.superIdeas)
          .where(eq(schema.superIdeas.id, row.targetId));
  if (!target) return null;

  return { kind, targetId: row.targetId, title: target.title, invitedBy: row.invitedBy };
}

export type AcceptResult =
  | { ok: true; kind: InviteKind; targetId: string }
  | { ok: false; error: string };

/**
 * Joining seeds the newcomer's own query box from the idea's prompt — the
 * "same prompt in their own text box" half of the collaboration model. Pins
 * stay in the one shared idea.
 */
export async function acceptInvite(
  userId: string,
  token: string,
): Promise<AcceptResult> {
  const db = requireDb();

  const invite = await readInvite(token);
  if (!invite) {
    return { ok: false, error: "That invite has expired or has already been used." };
  }

  if (invite.kind === "idea") {
    const [idea] = await db
      .select({ ownerId: schema.ideas.ownerId, query: schema.ideas.query })
      .from(schema.ideas)
      .where(eq(schema.ideas.id, invite.targetId));
    if (!idea) return { ok: false, error: "That idea no longer exists." };
    if (idea.ownerId === userId) {
      return { ok: false, error: "That is already your own idea." };
    }
    await addMember(invite.targetId, userId);
    await setDraft(userId, invite.targetId, idea.query);
  } else {
    const [superIdea] = await db
      .select({ ownerId: schema.superIdeas.ownerId })
      .from(schema.superIdeas)
      .where(eq(schema.superIdeas.id, invite.targetId));
    if (!superIdea) return { ok: false, error: "That super idea no longer exists." };
    if (superIdea.ownerId === userId) {
      return { ok: false, error: "That is already your own super idea." };
    }
    await addSuperMember(invite.targetId, userId);
    // Every idea inside gets its own seeded query box, so the newcomer lands
    // with all three prompts ready rather than three empty boxes.
    for (const idea of await listIdeasIn(invite.targetId)) {
      await setDraft(userId, idea.id, idea.query);
    }
  }

  await db
    .update(schema.invites)
    .set({ acceptedBy: userId, acceptedAt: new Date() })
    .where(eq(schema.invites.token, token));

  return { ok: true, kind: invite.kind, targetId: invite.targetId };
}
