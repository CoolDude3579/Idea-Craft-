import { eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/db";

import { hashPassword, verifyPassword } from "./password";

/**
 * Account records. No cookies here — see lib/auth.ts for sessions — so this
 * can be tested without a request context.
 */

/** The prototype admits two people. Raised by changing this, not the schema. */
export const MAX_ACCOUNTS = 2;

/** Multi-user needs shared storage; process memory would give each instance
    its own idea of who exists. */
function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error(
      "DATABASE_URL is required for accounts: without it every server " +
        "instance keeps its own users and nothing is shared.",
    );
  }
  return db;
}

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string };

export async function accountCount(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users);
  return row?.count ?? 0;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const db = requireDb();
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2) return { ok: false, error: "Name is too short." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: "That does not look like an email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Use at least 8 characters for the password." };
  }

  if ((await accountCount()) >= MAX_ACCOUNTS) {
    return {
      ok: false,
      error: `This prototype is limited to ${MAX_ACCOUNTS} accounts. Sign in with an existing one.`,
    };
  }

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, cleanEmail));
  if (existing) return { ok: false, error: "That email is already registered." };

  const [row] = await db
    .insert(schema.users)
    .values({
      name: cleanName,
      email: cleanEmail,
      passwordHash: await hashPassword(password),
    })
    .returning({ id: schema.users.id });
  if (!row) return { ok: false, error: "Could not create the account." };

  return { ok: true, userId: row.id };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthResult> {
  const db = requireDb();
  const [row] = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()));

  // Same message either way: which half was wrong is not the visitor's
  // business, and saying so enumerates accounts.
  const wrong = { ok: false as const, error: "Email or password is incorrect." };
  if (!row) return wrong;
  if (!(await verifyPassword(password, row.passwordHash))) return wrong;
  return { ok: true, userId: row.id };
}
