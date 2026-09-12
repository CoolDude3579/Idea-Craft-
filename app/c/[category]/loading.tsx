"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { findCategory } from "@/lib/core/categories";
import { sourceLabel } from "@/lib/core/source-labels";

/**
 * Shown by the App Router's Suspense boundary while the server page runs the
 * fan-out. A cold fan-out can take most of 30 seconds — the Met alone is one
 * request per artwork — so an unexplained blank page is the default experience
 * without this.
 *
 * It names the sources it is waiting on, taken from the category table rather
 * than from a response that does not exist yet, and counts the seconds so the
 * wait is legible instead of suspicious.
 */
const SLOW_AFTER_SECONDS = 12;

export function CategoryLoading() {
  const params = useParams<{ category: string }>();
  const category = findCategory(params?.category ?? "");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Every source this category can reach, in the order the registry lists them.
  const sourceIds = [
    ...new Set((category?.subcategories ?? []).flatMap((s) => s.sourceIds)),
  ];

  return (
    <main aria-busy="true">
      <p className="breadcrumb">← all angles</p>
      <h1 className="page">{category?.label ?? "Searching"}</h1>
      <p className="sub">{category?.blurb ?? "Fanning out to the open-licence sources."}</p>

      <div className="sourcebar">
        {sourceIds.map((sourceId) => (
          <span className="pill" key={sourceId}>
            {sourceLabel(sourceId)}: querying…
          </span>
        ))}
        <span>
          {seconds}s elapsed
        </span>
      </div>

      {seconds >= SLOW_AFTER_SECONDS ? (
        <p className="hint">
          Museum collections need one request per artwork, so this can take a
          few seconds.
        </p>
      ) : null}

      <ul className="results skeletons" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <li className="result no-thumb" key={row}>
            <div>
              <span className="skel skel-title" />
              <span className="skel skel-meta" />
              <span className="skel skel-line" />
              <span className="skel skel-line short" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default CategoryLoading;
