"use server";

import { redirect } from "next/navigation";

import { authenticate, endSession, register, startSession } from "@/lib/auth";

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/** Errors come back on the query string: a server action cannot return a
    value to a plain form post without client state, and this keeps the
    auth pages server-rendered. */
function back(path: string, error: string, next: string): never {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  redirect(`${path}?${params.toString()}`);
}

export async function signUpAction(form: FormData): Promise<void> {
  const next = field(form, "next");
  let userId: string;
  try {
    const result = await register(
      field(form, "name"),
      field(form, "email"),
      field(form, "password"),
    );
    if (!result.ok) back("/signup", result.error, next);
    userId = result.userId;
  } catch (error) {
    back("/signup", (error as Error).message, next);
  }
  await startSession(userId);
  redirect(next || "/");
}

export async function signInAction(form: FormData): Promise<void> {
  const next = field(form, "next");
  let userId: string;
  try {
    const result = await authenticate(field(form, "email"), field(form, "password"));
    if (!result.ok) back("/login", result.error, next);
    userId = result.userId;
  } catch (error) {
    back("/login", (error as Error).message, next);
  }
  await startSession(userId);
  redirect(next || "/");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
