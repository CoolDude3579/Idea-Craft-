import { cookies } from "next/headers";

/**
 * Palette choice, in a cookie rather than localStorage.
 *
 * The server renders the attribute, so the first paint is already the right
 * palette. A client-side toggle cannot manage that: it reads storage after
 * hydration, which means a visible flash of the wrong theme on every load
 * unless you inline a blocking script — and this app has no client state
 * anywhere else.
 *
 * "auto" stores nothing and leaves prefers-color-scheme in charge.
 */
export type Theme = "auto" | "light" | "dark";

export const THEME_COOKIE = "ir_theme";

export function isTheme(value: string | undefined): value is Theme {
  return value === "auto" || value === "light" || value === "dark";
}

export async function currentTheme(): Promise<Theme> {
  const jar = await cookies();
  const value = jar.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "auto";
}
