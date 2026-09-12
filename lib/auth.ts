import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb, schema } from "@/db";

/**
 * Accounts with no new dependencies: PBKDF2 through the Web Crypto API that
 * Node and Vercel both ship, and opaque random session tokens looked up in
 * Postgres. No bcrypt, no NextAuth, no secret to manage.
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA512. */
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 512;

const SESSION_COOKIE = "ir_session";
const SESSION_DAYS = 30;

/** The prototype admits two people. Raised by changing this, not the schema. */
export const MAX_ACCOUNTS = 2;

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Compares without leaking where two digests diverge. */
function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-512" },
    key,
    KEY_BITS,
  );
  return toHex(new Uint8Array(bits));
}

/** Stored as iterations.salt.hash, so the cost can be raised later in place. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return `${ITERATIONS}.${toHex(salt)}.${await derive(password, salt, ITERATIONS)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [iterations, salt, hash] = stored.split(".");
  if (!iterations || !salt || !hash) return false;
  const candidate = await derive(password, fromHex(salt), Number(iterations));
  return equalConstantTime(candidate, hash);
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

export async function accountCount(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users);
  return row?.count ?? 0;
}

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string };

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
