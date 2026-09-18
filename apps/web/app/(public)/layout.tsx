import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth/session";

/**
 * Gates the entire public job board — homepage, job detail, SEO landing pages
 * — behind sign-in. Any APPROVED account (any role) may browse; unauthenticated
 * visitors are redirected to /admin/login. /admin/** has its own separate gate
 * (app/admin/(protected)/layout.tsx) and isn't under this route group.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  await requireAdminUser();
  return children;
}
