import { inviteAction } from "@/app/actions";
import type { InviteKind } from "@/lib/invites";

import { InviteLink } from "./invite-link";

/** One share control for both ideas and super ideas. */
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

      {token ? <InviteLink token={token} /> : null}
    </section>
  );
}

export default SharePanel;
