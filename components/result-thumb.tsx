"use client";

import { useState } from "react";

/**
 * The provider's own thumbnail, hotlinked — we hold no copy of the media.
 *
 * A client component purely so a dead image can remove itself: providers
 * rotate and delete files, and a broken-image icon in a licence-accuracy tool
 * looks like the tool is wrong rather than the upstream host. Falling back to
 * the no-thumbnail layout is the honest result.
 */
export function ResultThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // alt is empty on purpose: the adjacent title already names the work, so
    // announcing it twice is noise for a screen reader.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}

export default ResultThumb;
