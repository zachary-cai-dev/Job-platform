import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma, getSearchService } from "@/lib/db";
import { parseJobsQuery } from "@/lib/queryParsing";

/**
 * GET /api/companies/:slug — company profile + its active jobs (paginated,
 * filterable). Gated, see app/(public)/layout.tsx.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const prisma = getPrisma();

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { slug: true, name: true, logoUrl: true, websiteUrl: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const parsed = parseJobsQuery(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const jobs = await getSearchService().search({
    ...parsed.params,
    filters: { ...parsed.params.filters, companySlug: slug },
  });

  return NextResponse.json({ company, jobs });
}
