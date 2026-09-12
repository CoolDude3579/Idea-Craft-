"use client";

import { useState } from "react";

/**
 * Shows the invite as a complete, copyable URL.
 *
 * It used to render the bare path with "prefix it with this site's address"
 * underneath. That reads fine and fails in practice: pasted from an idea page
 * the browser resolves it relative to /idea/, giving /idea/invite/<token> and a
 * 404. An instruction the user has to execute correctly is a bug.
 *
 * The origin comes from the browser rather than the server: a server-rendered
 * absolute URL would need a configured base URL, which is one more thing to get
 * wrong between localhost and the deployment.
 */
export function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined" ? `/invite/${token}` : `${window.location.origin}/invite/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard needs a secure context and permission. The field is
      // select-all on click, so there is always a manual route.
      setCopied(false);
    }
  }

  return (
    <div className="sharelink">
      <p className="sheetfacts">
        Single-use, expires in 7 days. Send this whole link to your
        collaborator:
      </p>
      <div className="invitecopy">
        <code>{url}</code>
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="sheetfacts">
        Whoever opens it can join once, then the link is spent.
      </p>
    </div>
  );
}

export default InviteLink;
