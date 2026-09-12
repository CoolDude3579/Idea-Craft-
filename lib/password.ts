/**
 * Password hashing and token minting, with no knowledge of cookies, requests
 * or Next. Split out of lib/auth.ts so it can be exercised by a plain node
 * script: crypto that cannot be tested without a running server is crypto
 * nobody tests.
 *
 * PBKDF2-HMAC-SHA512 through the Web Crypto API that Node and Vercel both
 * ship — no bcrypt, no argon2, no new dependency.
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA512. */
const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 512;

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

/** URL-safe random token, for sessions and invites. */
export function newToken(bytes = 32): string {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...random))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
