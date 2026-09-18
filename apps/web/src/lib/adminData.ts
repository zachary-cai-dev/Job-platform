import { getPrisma } from "./db.js";

export interface SourceAdminRow {
  slug: string;
  displayName: string;
  status: string;
  integrationMethod: string;
  lastRun: {
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    fetchedCount: number;
    europeEligibleCount: number;
    rejectedGeographyCount: number;
    rejectedRoleCategoryCount: number;
    createdCount: number;
    updatedCount: number;
    duplicateCount: number;
    errorCount: number;
    errorSample: unknown;
  } | null;
}

export interface AdminOverview {
  totalActiveJobs: number;
  totalCompanies: number;
  sources: SourceAdminRow[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const prisma = getPrisma();

  // Sequential, not Promise.all — four simultaneous connections from one burst hit
  // the same pooler connection-limit reliability issue as getFilterFacets did
  // before its own consolidation (packages/search/src/postgresJobSearchService.ts).
  // The admin page is a low-traffic, non-latency-critical view, so the small
  // serial-latency cost here is the right trade.
  const totalActiveJobs = await prisma.job.count({ where: { isActive: true } });
  const totalCompanies = await prisma.company.count();
  const sources = await prisma.source.findMany({ orderBy: [{ status: "asc" }, { displayName: "asc" }] });
  // One most-recent run per source (DISTINCT ON via Prisma's `distinct`, ordered).
  const lastRuns = await prisma.ingestionRun.findMany({
    orderBy: { startedAt: "desc" },
    distinct: ["sourceSlug"],
  });

  const lastRunBySource = new Map(lastRuns.map((run) => [run.sourceSlug, run]));

  return {
    totalActiveJobs,
    totalCompanies,
    sources: sources.map((source) => {
      const run = lastRunBySource.get(source.slug);
      return {
        slug: source.slug,
        displayName: source.displayName,
        status: source.status,
        integrationMethod: source.integrationMethod,
        lastRun: run
          ? {
              status: run.status,
              startedAt: run.startedAt,
              finishedAt: run.finishedAt,
              durationMs: run.durationMs,
              fetchedCount: run.fetchedCount,
              europeEligibleCount: run.europeEligibleCount,
              rejectedGeographyCount: run.rejectedGeographyCount,
              rejectedRoleCategoryCount: run.rejectedRoleCategoryCount,
              createdCount: run.createdCount,
              updatedCount: run.updatedCount,
              duplicateCount: run.duplicateCount,
              errorCount: run.errorCount,
              errorSample: run.errorSample,
            }
          : null,
      };
    }),
  };
}
