import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getSearchService } from "@/lib/db";

/** GET /api/filters — facet counts for building filter UI (brief §11/§23). Gated, see app/(public)/layout.tsx. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const facets = await getSearchService().getFilterFacets();
  return NextResponse.json(facets);
}
