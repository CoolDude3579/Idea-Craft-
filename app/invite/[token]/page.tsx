import Link from "next/link";

import { acceptInviteAction } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { readInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";

export async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const error = (Array.isArray(query["error"]) ? query["error"][0] : query["error"]) ?? "";

  const invite = await readInvite(token);
  const user = await currentUser();

  if (!invite) {
    return (
      <main className="authpane">
        <h1 className="page">Invite not valid</h1>
        <p className="sub">
          This link has expired or has already been used. Invites are single-use
          and last seven days — ask for a fresh one.
        </p>
        <p className="sub">
          <Link href="/">← home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="authpane">
      <h1 className="page">
        Join {invite.kind === "super" ? "super idea" : "idea"}: {invite.title}
      </h1>
      <p className="sub">
        {invite.invitedBy} invited you.{" "}
        {invite.kind === "super"
          ? "You will get your own query box for each idea inside it; everything you keep lands in the shared super idea."
          : "You will get your own query box for it; everything you keep lands in the shared idea."}
      </p>

      {error ? <p className="autherror">{error}</p> : null}

      {user ? (
        <form className="authform" action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit">Accept as {user.name}</button>
        </form>
      ) : (
        <p className="sub">
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
            Sign in
          </Link>{" "}
          or{" "}
          <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}>
            create an account
          </Link>{" "}
          to accept.
        </p>
      )}
    </main>
  );
}

export default InvitePage;
