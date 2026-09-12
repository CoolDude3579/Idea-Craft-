import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Idea Refinery",
  description:
    "Federated open-licence search. One query, many open sources, outbound links only.",
};

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="masthead">
            <Link href="/" className="brand">
              Idea <span>Refinery</span>
            </Link>
            <p className="tagline">
              Open-licence sources, deep-linked. We never host content.
            </p>
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
