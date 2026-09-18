import Link from "next/link";
import { signupAction } from "@/lib/auth/actions";

export const metadata = { robots: { index: false, follow: false } };

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Enter a valid email and a password of at least 10 characters.",
  exists: "An account with that email already exists.",
};

export default async function AdminSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-lg font-semibold text-foreground">Request admin access</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        New accounts need approval from an existing admin before they can sign in.
      </p>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}
        </p>
      )}

      <form action={signupAction} className="mt-4 space-y-3">
        <div>
          <label htmlFor="name" className="text-xs text-muted-foreground">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
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
            minLength={10}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Request access
        </button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Already approved?{" "}
        <Link href="/admin/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
