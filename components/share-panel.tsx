import { inviteAction } from "@/app/actions";
import type { InviteKind } from "@/lib/invites";

/**
 * One share control for both ideas and super ideas. The freshly minted link is
 * rendered as selectable text rather than copied by script: a clipboard write
 * needs a client component, and the user can select a line perfectly well.
 */
export function SharePanel({
  kind,
  targetId,
  members,
  token,
}: {
  kind: InviteKind;
  targetId: string;
  members: readonly { id: string; name: string; owner: boolean }[];
  token?: string;
}) {
  return (
    <section className="share">
      <div className="sharehead">
        <span className="sharelabel">
          {members.map((m) => `${m.name}${m.owner ? " (owner)" : ""}`).join(" · ")}
        </span>
        <form action={inviteAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="targetId" value={targetId} />
          <button type="submit">Create invite link</button>
        </form>
      </div>

      {token ? (
        <div className="sharelink">
          <p className="sheetfacts">
            Single-use, expires in 7 days. Send this to your collaborator:
          </p>
          <code>{`/invite/${token}`}</code>
          <p className="sheetfacts">
            Prefix it with this site&rsquo;s address. Anyone who opens it can
            join once, then the link is spent.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default SharePanel;
