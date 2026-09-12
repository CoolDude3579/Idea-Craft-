import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * V2 is multi-user. The two-account cap of the prototype is enforced at
 * signup, not here — the schema should not have to change to admit a third
 * person.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** PBKDF2, stored as iterations.salt.hash — never a plaintext password. */
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/**
 * Opaque random session tokens looked up here, rather than a signed cookie:
 * one DB read per request buys revocability and spares the app a secret to
 * manage.
 */
export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** A group of at most three ideas, for a project one category cannot hold. */
export const superIdeas = pgTable("super_ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** An idea someone catalogued, optionally filed under a super idea. */
export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Null when the idea stands alone. An idea belongs to one super at most. */
    superIdeaId: uuid("super_idea_id").references(() => superIdeas.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    query: text("query").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ideas_owner_idx").on(t.ownerId),
    index("ideas_super_idx").on(t.superIdeaId),
  ],
);

/** An idea fans out to many categories: research + posters + slogans. */
export const ideaCategories = pgTable(
  "idea_categories",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.categoryId] })],
);

/**
 * Collaborators on a single idea. Owners are not listed here; access is
 * "owner, or member, or a member of the parent super idea", so sharing a super
 * idea shares the ideas inside it without duplicating rows.
 */
export const ideaMembers = pgTable(
  "idea_members",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.ideaId, t.userId] }),
    index("idea_members_user_idx").on(t.userId),
  ],
);

/** Collaborators on a super idea, which grants its children too. */
export const superIdeaMembers = pgTable(
  "super_idea_members",
  {
    superIdeaId: uuid("super_idea_id")
      .notNull()
      .references(() => superIdeas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.superIdeaId, t.userId] }),
    index("super_idea_members_user_idx").on(t.userId),
  ],
);

/**
 * Single-use, expiring invite tokens. A link that never expires and works for
 * anybody is not a share, it is a hole.
 */
export const invites = pgTable(
  "invites",
  {
    token: text("token").primaryKey(),
    /** "idea" or "super" — which table targetId points at. */
    kind: text("kind").notNull(),
    targetId: uuid("target_id").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBy: uuid("accepted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("invites_target_idx").on(t.kind, t.targetId)],
);

/**
 * Results someone kept. Stores the contract-v1 payload verbatim.
 *
 * authorId is what makes a shared idea legible: with two people pinning into
 * one board, an export that cannot say who contributed what has thrown away
 * the provenance the whole product is built on. The unique index means the
 * second person to pin the same result is a no-op, so authorship is
 * first-come — correct de-duplication, worth knowing when reading the sheet.
 */
export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
    sourceId: text("source_id").notNull(),
    sourceKey: text("source_key").notNull(),
    url: text("url").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("pins_unique").on(t.ideaId, t.sourceId, t.sourceKey),
    index("pins_idea_idx").on(t.ideaId),
  ],
);

/**
 * Each collaborator's own query box for a shared idea. This is the whole
 * collaboration model: the prompt is copied to every member on share, each
 * edits their own copy freely, and the pins they produce land in the one
 * shared idea. No sockets, no shared cursors, no conflict resolution.
 */
export const ideaDrafts = pgTable(
  "idea_drafts",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.userId] })],
);

/** Fan-out cache keyed by normalised query + category. TTL enforced in SQL. */
export const searchCache = pgTable(
  "search_cache",
  {
    key: text("key").primaryKey(),
    payload: jsonb("payload").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("search_cache_expiry_idx").on(t.expiresAt)],
);
