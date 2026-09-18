"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession, requireStaffUser, requireSuperAdmin } from "./session";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const nameSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((value) => (value ? value : undefined));

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "Password must be at least 10 characters."),
  name: nameSchema,
});

const addUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "Password must be at least 10 characters."),
  name: nameSchema,
  role: z.enum(["ADMIN", "USER"]),
});

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
});

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/admin/login?error=invalid");

  const prisma = getPrisma();
  const user = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect("/admin/login?error=invalid");
  }
  if (user.status === "PENDING") redirect("/admin/login?error=pending");
  if (user.status === "DISABLED") redirect("/admin/login?error=disabled");

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

export async function signupAction(formData: FormData): Promise<void> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!parsed.success) redirect("/admin/signup?error=invalid");

  const prisma = getPrisma();
  const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) redirect("/admin/signup?error=exists");

  const passwordHash = await hashPassword(parsed.data.password);
  // First-ever account bootstraps itself as approved and SUPER_ADMIN so there's
  // someone able to approve everyone who signs up after them.
  const isFirstUser = (await prisma.adminUser.count()) === 0;

  const user = await prisma.adminUser.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
      status: isFirstUser ? "APPROVED" : "PENDING",
      role: isFirstUser ? "SUPER_ADMIN" : "USER",
      approvedAt: isFirstUser ? new Date() : null,
    },
  });

  if (isFirstUser) {
    await createSession(user.id);
    redirect("/");
  }

  redirect("/admin/login?notice=pending");
}

export async function approveUserAction(formData: FormData): Promise<void> {
  const staff = await requireStaffUser();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const prisma = getPrisma();
  await prisma.adminUser.update({
    where: { id: userId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: staff.id },
  });
  revalidatePath("/admin/users");
}

/**
 * Only SUPER_ADMIN may disable an ADMIN (or another SUPER_ADMIN); a plain
 * ADMIN may only disable USER-role accounts — otherwise any approved admin
 * account could lock out the account above it.
 */
export async function disableUserAction(formData: FormData): Promise<void> {
  const staff = await requireStaffUser();
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === staff.id) return;

  const prisma = getPrisma();
  const target = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!target) return;
  if (target.role === "SUPER_ADMIN") return;
  if (target.role === "ADMIN" && staff.role !== "SUPER_ADMIN") return;

  // Two plain statements, not $transaction — getPrisma() is the transaction-mode
  // pooled client, which can't run interactive/batched transactions reliably
  // (see packages/db/src/index.ts). No atomicity requirement here anyway:
  // getSessionUser() already denies a DISABLED user regardless of whether their
  // session row still exists, so the deleteMany below is just cleanup.
  await prisma.adminUser.update({ where: { id: userId }, data: { status: "DISABLED" } });
  await prisma.adminSession.deleteMany({ where: { userId } });
  revalidatePath("/admin/users");
}

export async function reinstateUserAction(formData: FormData): Promise<void> {
  const staff = await requireStaffUser();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const prisma = getPrisma();
  const target = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!target) return;
  if (target.role === "ADMIN" && staff.role !== "SUPER_ADMIN") return;

  await prisma.adminUser.update({
    where: { id: userId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: staff.id },
  });
  revalidatePath("/admin/users");
}

/** SUPER_ADMIN only — adds an account directly, already APPROVED, with a chosen role. */
export async function addUserAction(formData: FormData): Promise<void> {
  const superAdmin = await requireSuperAdmin();

  const parsed = addUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/admin/users?error=invalid");

  const prisma = getPrisma();
  const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) redirect("/admin/users?error=exists");

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.adminUser.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
      role: parsed.data.role,
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: superAdmin.id,
    },
  });
  revalidatePath("/admin/users");
}

/** SUPER_ADMIN only — grants or revokes the ADMIN role on an existing account. */
export async function setRoleAction(formData: FormData): Promise<void> {
  const superAdmin = await requireSuperAdmin();

  const parsed = setRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  if (parsed.data.userId === superAdmin.id) return;

  const prisma = getPrisma();
  const target = await prisma.adminUser.findUnique({ where: { id: parsed.data.userId } });
  if (!target || target.role === "SUPER_ADMIN") return;

  await prisma.adminUser.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });
  revalidatePath("/admin/users");
}
