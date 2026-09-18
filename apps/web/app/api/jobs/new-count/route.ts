import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getNewJobsCount } from "@/lib/newJobsCount";
import type { JobsTab } from "@/lib/urlFilters";

const VALID_TABS: JobsTab[] = ["all", "regionOnly", "usRemote"];

/**
 * GET /api/jobs/new-count?since=<ISO timestamp>&tab=<JobsTab> — powers the
 * client-side "N new jobs posted" notification (NewJobsNotifier), scoped to
 * whichever tab the viewer currently has open. `since` is required and must be
 * a valid, non-future timestamp; `tab` defaults to "all". Gated, see
 * app/(public)/layout.tsx.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  if (!sinceParam) {
    return NextResponse.json({ error: "since is required" }, { status: 400 });
  }

  const since = new Date(sinceParam);
  if (Number.isNaN(since.getTime()) || since.getTime() > Date.now()) {
    return NextResponse.json({ error: "since must be a valid, non-future timestamp" }, { status: 400 });
  }

  const tabParam = url.searchParams.get("tab");
  const tab: JobsTab = VALID_TABS.includes(tabParam as JobsTab) ? (tabParam as JobsTab) : "all";

  const result = await getNewJobsCount(since, tab);
  return NextResponse.json(result);
}
