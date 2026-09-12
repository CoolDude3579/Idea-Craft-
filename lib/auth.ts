import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb, schema } from "@/db";

import { newToken } from "./password";

/**
 * Sessions. Opaque random tokens looked up in Postgres rather than a signed
 * cookie: one DB read per request buys revocability and spares the app a
 * secret to manage.
 *
 * Account records and password hashing live in lib/accounts.ts and
 * lib/password.ts, which import nothing from Next and so can be tested by a
 * plain script. Re-exported here so pages have one place to import from.
 */
export {
  accountCount,
  authenticate,
  MAX_ACCOUNTS,
  register,
  type AuthResult,
} from "./accounts";

const SESSION_COOKIE = "ir_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is required for sessions.");
  return db;
}

export async function startSession(userId: string): Promise<void> {
  const db = requireDb();
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(schema.sessions).values({ token, userId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getDb();
    if (db) await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Safe to call on a public page. */
export async function currentUser(): Promise<SessionUser | null> {
  const db = getDb();
  if (!db) return null;

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.token, token),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    );

  return row ?? null;
}
