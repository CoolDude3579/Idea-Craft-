import Link from "next/link";
import { redirect } from "next/navigation";

import { signInAction } from "@/app/auth-actions";
import { accountCount, currentUser, MAX_ACCOUNTS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await currentUser()) redirect("/");

  const params = await searchParams;
  const one = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };

  const taken = await accountCount();

  return (
    <main className="authpane">
      <h1 className="page">Sign in</h1>
      <p className="sub">Your ideas, and the ones shared with you.</p>

      {one("error") ? <p className="autherror">{one("error")}</p> : null}

      <form className="authform" action={signInAction}>
        <input type="hidden" name="next" value={one("next")} />
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">Sign in</button>
      </form>

      <p className="sub">
        {taken < MAX_ACCOUNTS ? (
          <>
            No account yet? <Link href="/signup">Create one</Link> —{" "}
            {MAX_ACCOUNTS - taken} of {MAX_ACCOUNTS} places left in this
            prototype.
          </>
        ) : (
          <>Both prototype accounts are taken, so sign-up is closed.</>
        )}
      </p>
    </main>
  );
}

export default LoginPage;
