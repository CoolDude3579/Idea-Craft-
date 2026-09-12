"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isTheme, THEME_COOKIE } from "@/lib/theme";

/**
 * Sets the palette cookie and re-renders. A year, because a theme choice that
 * expires is a theme choice that comes back wrong.
 */
export async function setThemeAction(form: FormData): Promise<void> {
  const value = form.get("theme");
  if (typeof value !== "string" || !isTheme(value)) return;

  const jar = await cookies();
  if (value === "auto") {
    // Auto is the absence of a choice, so it is stored as one.
    jar.delete(THEME_COOKIE);
  } else {
    jar.set(THEME_COOKIE, value, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  revalidatePath("/", "layout");
}
