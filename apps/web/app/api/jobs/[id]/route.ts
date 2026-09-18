import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getJobDetail } from "@/lib/jobDetail";

/** GET /api/jobs/:id — full job detail (brief §27). Gated, see app/(public)/layout.tsx. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await getJobDetail(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
