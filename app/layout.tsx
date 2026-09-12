import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth-actions";
import { currentUser } from "@/lib/auth";

import "./globals.css";

/**
 * Display face for the lede and page titles, self-hosted by next/font at build
 * time — no runtime request to Google and no new dependency, since next/font
 * ships with Next. Body type stays system sans; the serif is editorial
 * flavour, not the reading face.
 */
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
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
              Idea <span>Craft</span>
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
