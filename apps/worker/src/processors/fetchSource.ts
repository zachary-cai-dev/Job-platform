import { Prisma, type PrismaClient } from "@euro-jobs/db";
import { ingestRawJobPayload, PrismaJobRepository } from "@euro-jobs/jobs";
import type { Logger } from "@euro-jobs/shared";
import { buildAdapter } from "../adapters/registry.js";

interface FetchStats {
  fetchedCount: number;
  europeEligibleCount: number;
  rejectedGeographyCount: number;
  rejectedRoleCategoryCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  errorCount: number;
  errorSample: Array<{ message: string; externalId?: string }>;
}

function emptyStats(): FetchStats {
  return {
    fetchedCount: 0,
    europeEligibleCount: 0,
    rejectedGeographyCount: 0,
    rejectedRoleCategoryCount: 0,
    createdCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
    errorSample: [],
  };
}

const MAX_ERROR_SAMPLE = 10;
const TRANSIENT_DATABASE_CODES = new Set(["P1001", "P1002", "P1017", "P2024", "P2028"]);
const TERMINAL_RAW_STATUSES = [
  "PUBLISHED",
  "REJECTED_GEOGRAPHY",
  "REJECTED_ROLE_CATEGORY",
  "MERGED_DUPLICATE",
] as const;

function jsonParserVersion(value: unknown): number | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const version = (value as Record<string, unknown>).parserVersion;
  return typeof version === "number" ? version : undefined;
}

/**
 * Detail-heavy sources receive identities whose current payload has already reached
 * a terminal pipeline state. LinkedIn additionally versions its parser so a parser
 * upgrade can refetch previously rejected details exactly once without refetching
 * every known listing forever.
 */
async function findKnownExternalIds(source: { slug: string; config: unknown }, prisma: PrismaClient) {
  if (!["linkedin", "remoteyeah", "wellfound"].includes(source.slug)) return undefined;

  const rawJobs = await prisma.rawJob.findMany({
    where: { sourceSlug: source.slug, processingStatus: { in: [...TERMINAL_RAW_STATUSES] } },
    select: { externalId: true, rawPayload: true },
  });

  const config = source.config && typeof source.config === "object" && !Array.isArray(source.config)
    ? source.config as Record<string, unknown>
    : {};
  const desiredParserVersion = typeof config.parserVersion === "number" ? config.parserVersion : undefined;
  if (desiredParserVersion === undefined) return new Set(rawJobs.map((job) => job.externalId));

  const listedIds = await prisma.jobSourceListing.findMany({
    where: { sourceSlug: source.slug },
    select: { externalId: true },
  });
  const known = new Set(listedIds.map((listing) => listing.externalId));
  for (const job of rawJobs) {
    if (jsonParserVersion(job.rawPayload) === desiredParserVersion) known.add(job.externalId);
  }
  return known;
}

function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "string" && TRANSIENT_DATABASE_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /server has closed the connection|connection.*closed|timed out fetching a new connection/i.test(message);
}

async function ingestWithTransientRetry(
  operation: () => ReturnType<typeof ingestRawJobPayload>,
  logger: Logger,
): ReturnType<typeof ingestRawJobPayload> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= 2) throw error;
      const delayMs = 500 * 2 ** attempt;
      logger.warn({ err: error, attempt: attempt + 1, delayMs }, "transient database error; retrying job ingestion");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * One full fetch → ingest cycle for a single source, run inside a BullMQ job
 * handler. Writes an `IngestionRun` row start-to-finish (docs/ingestion.md §10,
 * docs/data-model.md §9) so ingestion health is queryable without reading logs.
 * A per-job failure never aborts the whole run — it's counted and logged, and the
 * remaining jobs from this fetch still get processed (docs/ingestion.md §20: a
 * broken source must not stop ingestion from other sources, and a single bad
 * listing must not stop the rest of its own source's batch either).
 */
export async function processFetchSourceJob(
  sourceSlug: string,
  deps: { prisma: PrismaClient; logger: Logger },
): Promise<void> {
  const { prisma, logger } = deps;
  const log = logger.child({ sourceSlug });

  const source = await prisma.source.findUnique({ where: { slug: sourceSlug } });
  if (!source) {
    log.warn("scheduled fetch for unknown source slug; skipping");
    return;
  }

  const adapter = buildAdapter(source.slug, source.config, log);
  if (!adapter) {
    log.warn("no usable adapter/config for source; skipping");
    return;
  }

  const run = await prisma.ingestionRun.create({
    data: { sourceSlug: source.slug, status: "RUNNING" },
  });
  const runLog = log.child({ ingestionRunId: run.id });
  const startedAt = Date.now();
  const stats = emptyStats();
  const repo = new PrismaJobRepository(prisma);

  try {
    const knownExternalIds = await findKnownExternalIds(source, prisma);
    const { jobs, seenKnownExternalIds = [] } = await adapter.fetchJobs({ knownExternalIds });
    stats.fetchedCount = jobs.length + seenKnownExternalIds.length;
    runLog.info({ fetchedCount: stats.fetchedCount }, "fetched jobs from source");

    await repo.touchListingsLastSeen(source.slug, seenKnownExternalIds, new Date());

    for (const job of jobs) {
      const jobLog = runLog.child({ externalId: job.externalId });
      try {
        const outcome = await ingestWithTransientRetry(
          () => ingestRawJobPayload({
            ingestionRunId: run.id,
            input: { ...job, sourceSlug: source.slug },
            repo,
          }),
          jobLog,
        );

        switch (outcome.kind) {
          case "REJECTED_GEOGRAPHY":
            stats.rejectedGeographyCount += 1;
            break;
          case "REJECTED_ROLE_CATEGORY":
            stats.rejectedRoleCategoryCount += 1;
            break;
          case "CREATED":
            stats.europeEligibleCount += 1;
            stats.createdCount += 1;
            if (source.slug === "linkedin") {
              jobLog.info({ title: job.rawTitle, company: job.companyName }, "[linkedin] saved job");
            }
            break;
          case "MERGED":
            stats.europeEligibleCount += 1;
            stats.duplicateCount += 1;
            break;
          case "UPDATED_EXISTING_LISTING":
            stats.europeEligibleCount += 1;
            stats.updatedCount += 1;
            break;
          case "UNCHANGED":
            break;
        }
      } catch (error) {
        stats.errorCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        if (stats.errorSample.length < MAX_ERROR_SAMPLE) {
          stats.errorSample.push({ message, externalId: job.externalId });
        }
        jobLog.error({ err: error }, "failed to ingest raw job; continuing with the rest of the batch");
      }
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: stats.errorCount > 0 ? "PARTIAL" : "SUCCESS",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        fetchedCount: stats.fetchedCount,
        europeEligibleCount: stats.europeEligibleCount,
        rejectedGeographyCount: stats.rejectedGeographyCount,
        rejectedRoleCategoryCount: stats.rejectedRoleCategoryCount,
        createdCount: stats.createdCount,
        updatedCount: stats.updatedCount,
        duplicateCount: stats.duplicateCount,
        errorCount: stats.errorCount,
        errorSample: stats.errorSample as unknown as Prisma.InputJsonValue,
      },
    });
    runLog.info({ ...stats }, "ingestion run finished");
    if (source.slug === "linkedin") {
      runLog.info(
        {
          searches: "see adapter logs",
          jobsDiscovered: stats.fetchedCount,
          newJobs: stats.createdCount,
          duplicates: stats.duplicateCount + seenKnownExternalIds.length,
          expired: "see adapter logs",
          failed: stats.errorCount,
          blockedOrRateLimited: "see adapter logs",
        },
        "[linkedin] LinkedIn collection complete",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        fetchedCount: stats.fetchedCount,
        errorCount: stats.errorCount + 1,
        errorSample: [...stats.errorSample, { message }] as unknown as Prisma.InputJsonValue,
      },
    });
    runLog.error({ err: error }, "ingestion run failed outright (source fetch itself errored)");
    throw error; // let BullMQ's retry/backoff see this too
  }
}
