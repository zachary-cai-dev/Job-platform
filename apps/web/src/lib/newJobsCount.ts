import type { Prisma, RegionCode } from "@euro-jobs/db";
import { getPrisma } from "./db.js";
import { DEFAULT_REGION_FILTER } from "./queryParsing.js";
import type { NewJobsCount } from "./types.js";
import type { JobsTab } from "./urlFilters.js";

/**
 * Scopes the "new jobs" count to whatever the viewer's current tab actually
 * shows (apps/web/src/lib/queryParsing.ts's resolveTabOverrides is the same
 * decision for the main search query) — otherwise a viewer sitting on the "US
 * remote" tab would get a notification counting newly-discovered *European*
 * jobs, which never matches what's on their screen.
 */
function jobWhereForTab(tab: JobsTab): Prisma.JobWhereInput {
  if (tab === "usRemote") {
    return {
      isActive: true,
      remoteType: "FULLY_REMOTE",
      OR: [{ eligibleCountries: { has: "US" } }, { eligibleRegions: { has: "WORLDWIDE" } }],
    };
  }
  return { isActive: true, eligibleRegions: { hasSome: DEFAULT_REGION_FILTER as RegionCode[] } };
}

/**
 * Counts newly-discovered listings since `since`, scoped to the given tab's own
 * eligibility rule — so a "5 new jobs" notification always matches what's
 * actually visible without the viewer having to change any filter first.
 */
export async function getNewJobsCount(since: Date, tab: JobsTab = "all"): Promise<NewJobsCount> {
  const prisma = getPrisma();
  const checkedAt = new Date();

  const rows = await prisma.jobSourceListing.groupBy({
    by: ["sourceSlug"],
    where: {
      firstDiscoveredAt: { gt: since, lte: checkedAt },
      isActive: true,
      job: jobWhereForTab(tab),
    },
    _count: { _all: true },
  });

  if (rows.length === 0) {
    return { total: 0, bySource: [], checkedAt: checkedAt.toISOString() };
  }

  const sources = await prisma.source.findMany({
    where: { slug: { in: rows.map((row) => row.sourceSlug) } },
    select: { slug: true, displayName: true },
  });
  const displayNameBySlug = new Map(sources.map((source) => [source.slug, source.displayName]));

  const bySource = rows
    .map((row) => ({
      slug: row.sourceSlug,
      displayName: displayNameBySlug.get(row.sourceSlug) ?? row.sourceSlug,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: bySource.reduce((sum, entry) => sum + entry.count, 0),
    bySource,
    checkedAt: checkedAt.toISOString(),
  };
}
