import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export async function TopBar() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
            E
          </span>
          Euro Jobs
        </Link>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Fresh remote tech jobs for candidates based in Europe
        </p>
        {user && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {user.role !== "USER" && (
              <Link href="/admin" className="hover:text-foreground">
                Admin
              </Link>
            )}
            <span>{user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="underline hover:text-foreground">
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
