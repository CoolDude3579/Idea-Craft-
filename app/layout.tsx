import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth-actions";
import { currentUser } from "@/lib/auth";

import "./globals.css";

/**
 * Display face for the lede and page titles, self-hosted by next/font at build
 * time — no runtime request to Google and no new dependency, since next/font
 * ships with Next.
 *
 * Playfair Display rather than Instrument Serif: the reference design's
 * headline has high stroke contrast and real weight behind it, which
 * Instrument Serif (one light 400) cannot reach. 600 and 700 are the only
 * weights loaded — body type stays system sans, since the serif is the
 * headline voice, not the reading face.
 */
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
  fallback: ["Iowan Old Style", "Palatino", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "Idea Craft",
  description:
    "Federated open-licence search. One query, many open sources, outbound links only.",
};

export async function RootLayout({ children }: { children: ReactNode }) {
  // Layouts render on every page including the auth pages, so this must
  // tolerate there being nobody signed in.
  const user = await currentUser();

  return (
    <html lang="en" className={display.variable}>
      <body>
        <div className="shell">
          <header className="masthead">
            <Link href="/" className="brand">
              <span className="brandmark" aria-hidden="true">
                {/* The one decorative use of the accent, and the only icon. */}
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                  <path
                    d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 20h4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              Idea <span className="brandword">Craft</span>
            </Link>
            {user ? (
              <div className="whoami">
                <span className="tagline">{user.name}</span>
                <form action={signOutAction}>
                  <button type="submit">Sign out</button>
                </form>
              </div>
            ) : (
              <p className="tagline">
                Open-licence sources, deep-linked. We never host content.
              </p>
            )}
          </header>
          {children}
          <footer className="footer">
            Results link out to the providers. Licences are reported as the
            provider states them; verify before reuse.
          </footer>
        </div>
      </body>
    </html>
  );
}

// App Router resolves layouts and pages by default export only; every file
// under app/ therefore re-exports its named component as the default.
export default RootLayout;
