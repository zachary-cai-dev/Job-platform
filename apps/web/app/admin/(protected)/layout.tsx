import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { requireAdminUser } from "@/lib/auth/session";

export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminUser();

  return (
    <div>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-medium text-foreground">
              Overview
            </Link>
            {user.role !== "USER" && (
              <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">
                Users
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="underline hover:text-foreground">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
