import {
  addUserAction,
  approveUserAction,
  disableUserAction,
  reinstateUserAction,
  setRoleAction,
} from "@/lib/auth/actions";
import { requireStaffUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import { formatRelativeTime } from "@/lib/relativeTime";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  DISABLED: "bg-muted text-muted-foreground",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-50 text-violet-700",
  ADMIN: "bg-blue-50 text-blue-700",
  USER: "bg-muted text-muted-foreground",
};

const ADD_USER_ERRORS: Record<string, string> = {
  invalid: "Enter a valid email and a password of at least 10 characters.",
  exists: "An account with that email already exists.",
};

function Pill({ value, colors }: { value: string; colors: Record<string, string> }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors[value] ?? "bg-muted text-muted-foreground"}`}
    >
      {value}
    </span>
  );
}

/**
 * Staff account management. ADMIN/SUPER_ADMIN can approve pending signups and
 * disable/reinstate USER accounts; only SUPER_ADMIN can add accounts directly
 * or grant/revoke the ADMIN role — see apps/web/src/lib/auth/actions.ts.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const currentUser = await requireStaffUser();
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";

  const prisma = getPrisma();
  const users = await prisma.adminUser.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Admin users</h1>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Requested</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const canManageTarget =
                user.role !== "SUPER_ADMIN" && (isSuperAdmin || user.role !== "ADMIN");

              return (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-foreground">
                    {user.email}
                    {user.id === currentUser.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{user.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Pill value={user.role} colors={ROLE_COLORS} />
                  </td>
                  <td className="px-4 py-2">
                    <Pill value={user.status} colors={STATUS_COLORS} />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatRelativeTime(user.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {user.status === "PENDING" && canManageTarget && (
                        <>
                          <form action={approveUserAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={disableUserAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-red-600 hover:bg-muted"
                            >
                              Reject
                            </button>
                          </form>
                        </>
                      )}
                      {user.status === "APPROVED" && user.id !== currentUser.id && canManageTarget && (
                        <form action={disableUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-red-600 hover:bg-muted"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                      {user.status === "DISABLED" && canManageTarget && (
                        <form action={reinstateUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            Reinstate
                          </button>
                        </form>
                      )}
                      {isSuperAdmin && user.id !== currentUser.id && user.role !== "SUPER_ADMIN" && (
                        <form action={setRoleAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="role" value={user.role === "ADMIN" ? "USER" : "ADMIN"} />
                          <button
                            type="submit"
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            {user.role === "ADMIN" ? "Revoke admin" : "Make admin"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isSuperAdmin && (
        <div className="mt-8 max-w-md rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Add a user</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Added directly and already approved — no pending step.
          </p>

          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {ADD_USER_ERRORS[error] ?? "Something went wrong. Try again."}
            </p>
          )}

          <form action={addUserAction} className="mt-3 space-y-3">
            <div>
              <label htmlFor="name" className="text-xs text-muted-foreground">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
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
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
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
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label htmlFor="role" className="text-xs text-muted-foreground">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue="USER"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Add user
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
