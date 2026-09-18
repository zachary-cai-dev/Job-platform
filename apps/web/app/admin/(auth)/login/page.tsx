import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";

export const metadata = { robots: { index: false, follow: false } };

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  pending: "Your account is awaiting admin approval.",
  disabled: "Your account has been disabled.",
};

const NOTICE_MESSAGES: Record<string, string> = {
  pending: "Account created. An existing admin needs to approve it before you can sign in.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-lg font-semibold text-foreground">Admin sign in</h1>

      {notice && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {NOTICE_MESSAGES[notice] ?? notice}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}
        </p>
      )}

      <form action={loginAction} className="mt-4 space-y-3">
        <div>
          <label htmlFor="email" className="text-xs text-muted-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-xs text-muted-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Sign in
        </button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Need access?{" "}
        <Link href="/admin/signup" className="underline">
          Request an account
        </Link>
      </p>
    </main>
  );
}
