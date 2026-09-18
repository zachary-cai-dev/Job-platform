import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";

/** GET /api/companies — companies with at least one currently active job. Gated, see app/(public)/layout.tsx. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  const companies = await prisma.company.findMany({
    where: { jobs: { some: { isActive: true } } },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      websiteUrl: true,
      _count: { select: { jobs: { where: { isActive: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    companies.map((company) => ({
      slug: company.slug,
      name: company.name,
      logoUrl: company.logoUrl,
      websiteUrl: company.websiteUrl,
      activeJobCount: company._count.jobs,
    })),
  );
}
