import { Prisma, type PrismaClient } from "@euro-jobs/db";
import { slugifyCompanyName } from "./companySlug.js";
import type {
  ExistingJobSnapshot,
  JobRepositoryPort,
  ListingUpsertRecord,
  NewJobRecord,
  ProcessingStatus,
  UpsertRawJobInput,
  UpsertRawJobResult,
} from "./types.js";

/** How far back to look for dedup candidates — open reqs don't usually live forever. */
const CANDIDATE_WINDOW_DAYS = 45;
const CANDIDATE_LIMIT = 20;
const TITLE_SIMILARITY_FLOOR = 0.4;

/**
 * Prisma's default interactive-transaction timeout (5s) is tight for a pooled
 * connection over a WAN to Supabase — hit for real during development under
 * ordinary network latency variance (`P2028: Transaction already closed`, ~5.2s
 * elapsed against a 5s limit). These transactions do 2-3 small writes each, not
 * heavy work, so a longer timeout is a safe tolerance increase, not a mask for a
 * runaway query.
 */
const TRANSACTION_OPTIONS = { timeout: 30_000 };

interface CandidateRow {
  id: string;
  companyName: string;
  normalizedTitle: string;
  applyUrl: string;
  descriptionText: string;
  eligibleCountries: string[];
  eligibleRegions: string[];
  geographyConfidence: string;
  postedAt: Date | null;
  postedAtIsInferred: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}

function rowToSnapshot(row: CandidateRow): ExistingJobSnapshot {
  return {
    id: row.id,
    companyName: row.companyName,
    normalizedTitle: row.normalizedTitle,
    applyUrl: row.applyUrl,
    descriptionText: row.descriptionText,
    eligibleCountries: row.eligibleCountries,
    eligibleRegions: row.eligibleRegions,
    geographyConfidence: row.geographyConfidence as ExistingJobSnapshot["geographyConfidence"],
    postedAt: row.postedAt,
    postedAtIsInferred: row.postedAtIsInferred,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod as ExistingJobSnapshot["salaryPeriod"],
  };
}

/**
 * The only concrete implementation of `JobRepositoryPort`, backed by Prisma/Postgres.
 * Everything source-agnostic and business-rule-shaped lives in the pure orchestrator
 * (`ingestRawJobPayload.ts`) instead — this class is deliberately "dumb": it applies
 * exactly the writes it's told to, with no decision-making of its own.
 */
export class PrismaJobRepository implements JobRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertRawJob(input: UpsertRawJobInput): Promise<UpsertRawJobResult> {
    const existing = await this.prisma.rawJob.findUnique({
      where: {
        sourceSlug_externalId_checksum: {
          sourceSlug: input.sourceSlug,
          externalId: input.externalId,
          checksum: input.checksum,
        },
      },
      select: { id: true, processingStatus: true },
    });
    if (existing) {
      // Same content as a previous capture — but if that previous attempt never
      // reached a terminal status (e.g. the process crashed mid-transaction), it
      // was never actually turned into a Job. Content-identical is not the same as
      // already-handled; only skip reprocessing once it truly finished. Caught for
      // real during development: a transient transaction error left a row stuck at
      // PENDING, and without this check an unchanged re-fetch would silently skip
      // it forever.
      const terminalStatuses: ProcessingStatus[] = [
        "PUBLISHED",
        "REJECTED_GEOGRAPHY",
        "REJECTED_ROLE_CATEGORY",
        "MERGED_DUPLICATE",
      ];
      const isTerminal = terminalStatuses.includes(existing.processingStatus as ProcessingStatus);
      return { rawJobId: existing.id, isNewOrChanged: !isTerminal };
    }

    const created = await this.prisma.rawJob.create({
      data: {
        sourceSlug: input.sourceSlug,
        externalId: input.externalId,
        sourceUrl: input.sourceUrl,
        rawPayload: input.rawPayload as Prisma.InputJsonValue,
        rawLocation: input.rawLocation,
        rawTitle: input.rawTitle,
        checksum: input.checksum,
        ingestionRunId: input.ingestionRunId,
        processingStatus: "PENDING",
      },
      select: { id: true },
    });
    return { rawJobId: created.id, isNewOrChanged: true };
  }

  async markRawJobStatus(rawJobId: string, status: ProcessingStatus, error?: string): Promise<void> {
    await this.prisma.rawJob.update({
      where: { id: rawJobId },
      data: { processingStatus: status, processingError: error ?? null },
    });
  }

  async findListingBySourceAndExternalId(
    sourceSlug: string,
    externalId: string,
  ): Promise<{ listingId: string; job: ExistingJobSnapshot } | null> {
    const listing = await this.prisma.jobSourceListing.findUnique({
      where: { sourceSlug_externalId: { sourceSlug, externalId } },
      include: { job: { include: { company: true } } },
    });
    if (!listing) return null;

    return {
      listingId: listing.id,
      job: rowToSnapshot({
        id: listing.job.id,
        companyName: listing.job.company.name,
        normalizedTitle: listing.job.normalizedTitle,
        applyUrl: listing.job.applyUrl,
        descriptionText: listing.job.descriptionText,
        eligibleCountries: listing.job.eligibleCountries,
        eligibleRegions: listing.job.eligibleRegions,
        geographyConfidence: listing.job.geographyConfidence,
        postedAt: listing.job.postedAt,
        postedAtIsInferred: listing.job.postedAtIsInferred,
        salaryMin: listing.job.salaryMin,
        salaryMax: listing.job.salaryMax,
        salaryCurrency: listing.job.salaryCurrency,
        salaryPeriod: listing.job.salaryPeriod,
      }),
    };
  }

  async findDedupCandidates(companyName: string, normalizedTitle: string): Promise<ExistingJobSnapshot[]> {
    const cutoff = new Date(Date.now() - CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<CandidateRow[]>`
      SELECT
        j.id,
        c.name AS "companyName",
        j."normalizedTitle",
        j."applyUrl",
        j."descriptionText",
        j."eligibleCountries",
        j."eligibleRegions"::text[] AS "eligibleRegions",
        j."geographyConfidence"::text AS "geographyConfidence",
        j."postedAt",
        j."postedAtIsInferred",
        j."salaryMin",
        j."salaryMax",
        j."salaryCurrency",
        j."salaryPeriod"::text AS "salaryPeriod"
      FROM "jobs" j
      JOIN "companies" c ON c.id = j."companyId"
      WHERE j."isActive" = true
        AND j."firstDiscoveredAt" >= ${cutoff}
        AND lower(c.name) = lower(${companyName})
        AND similarity(j."normalizedTitle", ${normalizedTitle}) > ${TITLE_SIMILARITY_FLOOR}
      ORDER BY similarity(j."normalizedTitle", ${normalizedTitle}) DESC
      LIMIT ${CANDIDATE_LIMIT}
    `;

    return rows.map(rowToSnapshot);
  }

  async createJobWithListing(input: NewJobRecord): Promise<{ jobId: string; listingId: string }> {
    const companySlug = slugifyCompanyName(input.companyName);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.upsert({
        where: { slug: companySlug },
        create: { slug: companySlug, name: input.companyName, websiteUrl: input.companyUrl },
        update: { websiteUrl: input.companyUrl ?? undefined },
      });

      const job = await tx.job.create({
        data: {
          title: input.title,
          normalizedTitle: input.normalizedTitle,
          roleCategorySlug: input.roleCategorySlug,
          seniority: input.seniority ?? undefined,
          tags: input.tags,
          companyId: company.id,
          description: input.description,
          descriptionText: input.descriptionText,
          locationRaw: input.locationRaw,
          locationDisplay: input.locationDisplay,
          remoteType: input.remoteType,
          eligibleCountries: input.eligibleCountries,
          eligibleRegions: input.eligibleRegions,
          geographyConfidence: input.geographyConfidence,
          geographyReason: input.geographyReason,
          employmentType: input.employmentType ?? undefined,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          salaryCurrency: input.salaryCurrency,
          salaryPeriod: input.salaryPeriod ?? undefined,
          skills: input.skills,
          postedAt: input.postedAt,
          postedAtIsInferred: input.postedAtIsInferred,
          applyUrl: input.applyUrl,
          fingerprint: input.fingerprint,
          technologies: {
            create: input.technologySlugs.map((technologySlug) => ({ technologySlug })),
          },
        },
        select: { id: true },
      });

      const listing = await tx.jobSourceListing.create({
        data: {
          jobId: job.id,
          sourceSlug: input.sourceSlug,
          externalId: input.externalId,
          sourceUrl: input.sourceUrl,
          applyUrl: input.applyUrl,
          postedAt: input.postedAt,
          postedAtIsInferred: input.postedAtIsInferred,
        },
        select: { id: true },
      });

      return { jobId: job.id, listingId: listing.id };
    }, TRANSACTION_OPTIONS);
  }

  async upsertListingAndReconcileJob(input: ListingUpsertRecord): Promise<{ listingId: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: input.jobId },
        data: {
          postedAt: input.reconciled.postedAt,
          postedAtIsInferred: input.reconciled.postedAtIsInferred,
          salaryMin: input.reconciled.salaryMin,
          salaryMax: input.reconciled.salaryMax,
          salaryCurrency: input.reconciled.salaryCurrency,
          salaryPeriod: input.reconciled.salaryPeriod ?? undefined,
          lastSeenAt: new Date(),
          isActive: true,
        },
      });

      const listing = await tx.jobSourceListing.upsert({
        where: { sourceSlug_externalId: { sourceSlug: input.sourceSlug, externalId: input.externalId } },
        create: {
          jobId: input.jobId,
          sourceSlug: input.sourceSlug,
          externalId: input.externalId,
          sourceUrl: input.sourceUrl,
          applyUrl: input.applyUrl,
          postedAt: input.postedAt,
          postedAtIsInferred: input.postedAtIsInferred,
        },
        update: {
          sourceUrl: input.sourceUrl,
          applyUrl: input.applyUrl,
          postedAt: input.postedAt,
          postedAtIsInferred: input.postedAtIsInferred,
          lastSeenAt: new Date(),
          isActive: true,
        },
        select: { id: true },
      });

      return { listingId: listing.id };
    }, TRANSACTION_OPTIONS);
  }

  async touchListingLastSeen(sourceSlug: string, externalId: string, now: Date): Promise<void> {
    const listing = await this.prisma.jobSourceListing.findUnique({
      where: { sourceSlug_externalId: { sourceSlug, externalId } },
      select: { id: true, jobId: true },
    });
    if (!listing) return;

    await this.prisma.$transaction([
      this.prisma.jobSourceListing.update({
        where: { id: listing.id },
        data: { lastSeenAt: now, isActive: true },
      }),
      this.prisma.job.update({
        where: { id: listing.jobId },
        data: { lastSeenAt: now, isActive: true },
      }),
    ]);
  }

  async touchListingsLastSeen(sourceSlug: string, externalIds: string[], now: Date): Promise<void> {
    if (externalIds.length === 0) return;
    const listings = await this.prisma.jobSourceListing.findMany({
      where: { sourceSlug, externalId: { in: externalIds } },
      select: { jobId: true },
    });
    const jobIds = [...new Set(listings.map((listing) => listing.jobId))];
    await this.prisma.$transaction([
      this.prisma.jobSourceListing.updateMany({
        where: { sourceSlug, externalId: { in: externalIds } },
        data: { lastSeenAt: now, isActive: true },
      }),
      this.prisma.job.updateMany({
        where: { id: { in: jobIds } },
        data: { lastSeenAt: now, isActive: true },
      }),
    ]);
  }
}
