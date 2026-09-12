import Link from "next/link";
import { redirect } from "next/navigation";

import { signUpAction } from "@/app/auth-actions";
import { accountCount, currentUser, MAX_ACCOUNTS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function SignupPage({
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
  const full = taken >= MAX_ACCOUNTS;

  return (
    <main className="authpane">
      <h1 className="page">Create an account</h1>
      <p className="sub">
        {full
          ? `This prototype is limited to ${MAX_ACCOUNTS} accounts and both are taken.`
          : `${MAX_ACCOUNTS - taken} of ${MAX_ACCOUNTS} places left in this prototype.`}
      </p>

      {one("error") ? <p className="autherror">{one("error")}</p> : null}

      {full ? null : (
        <form className="authform" action={signUpAction}>
          <input type="hidden" name="next" value={one("next")} />
          <label>
            Name
            <input type="text" name="name" autoComplete="name" required />
          </label>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="authhint">At least 8 characters.</span>
          </label>
          <button type="submit">Create account</button>
        </form>
      )}

      <p className="sub">
        Already have one? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}

export default SignupPage;
