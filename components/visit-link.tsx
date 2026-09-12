"use client";

import type { ReactNode } from "react";

import { pinVisited } from "@/app/actions";
import type { SourceResult } from "@/types/source-result";

/**
 * Opening a result is the strongest signal the user wants to keep it, so the
 * click-through pins it instead of asking them to find a button afterwards.
 * The pin is fire-and-forget: the new tab opens at once and never waits on it,
 * and pin() de-dupes, so re-opening the same link changes nothing.
 */
export function VisitLink({
  query,
  categoryId,
  result,
  children,
}: {
  query: string;
  categoryId: string;
  result: SourceResult;
  children: ReactNode;
}) {
  const keep = () => {
    void pinVisited(query, categoryId, result).catch(() => {
      // A failed auto-pin must never break the click-through: the user still
      // gets the provider page, and the explicit Pin button is still there.
    });
  };

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={keep}
      onAuxClick={(event) => {
        if (event.button === 1) keep(); // middle-click opens a tab too
      }}
    >
      {children}
    </a>
  );
}

export default VisitLink;
