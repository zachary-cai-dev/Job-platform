import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getSearchService } from "@/lib/db";
import { parseJobsQuery } from "@/lib/queryParsing";

/**
 * GET /api/jobs?q=...&role=...&region=...&country=...&seniority=...&technology=...
 *   &employmentType=...&source=...&excludeSource=...&salaryMin=...&salaryMax=...
 *   &postedWithin=24h&sort=newest&page=1&pageSize=20
 *
 * See src/lib/queryParsing.ts for the full contract (mirrors brief §23). Gated
 * the same as the pages that call it — see app/(public)/layout.tsx.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = parseJobsQuery(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await getSearchService().search(parsed.params);
  return NextResponse.json(result);
}
