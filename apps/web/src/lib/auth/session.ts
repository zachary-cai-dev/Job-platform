import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";

const SESSION_COOKIE = "admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Opaque random token, not a JWT — the cookie itself carries no claims, so a
 * disabled/removed AdminUser or a deleted AdminSession row takes effect on the
 * very next request instead of waiting out a token's signed lifetime.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const prisma = getPrisma();
  await prisma.adminSession.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Site-wide, not just "/admin" — the same session now also gates the public
    // job board (see app/(public)/layout.tsx), not only the /admin panel.
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const prisma = getPrisma();
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "USER";

export interface AuthenticatedAdminUser {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
}

/** Null whenever the cookie is missing, expired, revoked, or the account is no longer APPROVED. */
export async function getSessionUser(): Promise<AuthenticatedAdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const prisma = getPrisma();
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } });
    return null;
  }

  if (session.user.status !== "APPROVED") return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

/**
 * Server Component / Server Action guard — redirects to the login page instead
 * of returning null. Used both by /admin and by the public job board's own
 * (public) layout: any APPROVED account of any role may browse the site.
 */
export async function requireAdminUser(): Promise<AuthenticatedAdminUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** ADMIN or SUPER_ADMIN — the tiers that can manage other accounts. Plain USER redirected to the overview. */
export async function requireStaffUser(): Promise<AuthenticatedAdminUser> {
  const user = await requireAdminUser();
  if (user.role === "USER") redirect("/admin");
  return user;
}

/** SUPER_ADMIN only — adding accounts directly and granting/revoking the ADMIN role. */
export async function requireSuperAdmin(): Promise<AuthenticatedAdminUser> {
  const user = await requireAdminUser();
  if (user.role !== "SUPER_ADMIN") redirect("/admin");
  return user;
}
