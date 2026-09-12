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

/** An idea the user catalogued. Single-user prototype: no owner column. */
export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  query: text("query").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

/** Results the user kept. Stores the contract-v1 payload verbatim. */
export const pins = pgTable(
  "pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
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
