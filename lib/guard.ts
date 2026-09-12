import { redirect } from "next/navigation";

import { currentUser, type SessionUser } from "./auth";

/**
 * Page-level guard rather than middleware: middleware runs on the edge
 * runtime, where postgres-js cannot open a socket, so a session lookup there
 * would fail in production while appearing to work in dev.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (user) return user;
  redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
}
