import type {
  ExistingJobSnapshot,
  JobRepositoryPort,
  ListingUpsertRecord,
  NewJobRecord,
  ProcessingStatus,
  UpsertRawJobInput,
  UpsertRawJobResult,
} from "../src/types.js";

interface StoredJob extends ExistingJobSnapshot {
  companySlug: string;
  employmentType?: NewJobRecord["employmentType"];
}

interface StoredListing {
  id: string;
  jobId: string;
  sourceSlug: string;
  externalId: string;
  sourceUrl: string;
  applyUrl: string;
  postedAt: Date | null;
  postedAtIsInferred: boolean;
}

interface StoredRawJob {
  id: string;
  sourceSlug: string;
  externalId: string;
  checksum: string;
  status: ProcessingStatus;
  error?: string;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for `PrismaJobRepository`, implementing exactly
 * `JobRepositoryPort` — lets `ingestRawJobPayload` be unit-tested without a
 * database. Test files seed it directly via `jobs`/`listings` for merge/update
 * scenarios and read it back afterward to assert on the resulting state.
 */
export class FakeJobRepository implements JobRepositoryPort {
  rawJobs: StoredRawJob[] = [];
  jobs: Map<string, StoredJob> = new Map();
  listings: Map<string, StoredListing> = new Map();

  seedJob(job: Omit<StoredJob, "id"> & { id?: string }): StoredJob {
    const id = job.id ?? nextId("job");
    const stored: StoredJob = { ...job, id };
    this.jobs.set(id, stored);
    return stored;
  }

  seedListing(listing: Omit<StoredListing, "id"> & { id?: string }): StoredListing {
    const id = listing.id ?? nextId("listing");
    const stored: StoredListing = { ...listing, id };
    this.listings.set(id, stored);
    return stored;
  }

  async upsertRawJob(input: UpsertRawJobInput): Promise<UpsertRawJobResult> {
    const existing = this.rawJobs.find(
      (row) =>
        row.sourceSlug === input.sourceSlug &&
        row.externalId === input.externalId &&
        row.checksum === input.checksum,
    );
    if (existing) {
      const terminal: ProcessingStatus[] = [
        "PUBLISHED",
        "REJECTED_GEOGRAPHY",
        "REJECTED_ROLE_CATEGORY",
        "MERGED_DUPLICATE",
      ];
      return { rawJobId: existing.id, isNewOrChanged: !terminal.includes(existing.status) };
    }
    const created: StoredRawJob = {
      id: nextId("raw"),
      sourceSlug: input.sourceSlug,
      externalId: input.externalId,
      checksum: input.checksum,
      status: "PENDING",
    };
    this.rawJobs.push(created);
    return { rawJobId: created.id, isNewOrChanged: true };
  }

  async markRawJobStatus(rawJobId: string, status: ProcessingStatus, error?: string): Promise<void> {
    const row = this.rawJobs.find((r) => r.id === rawJobId);
    if (row) {
      row.status = status;
      row.error = error;
    }
  }

  async findListingBySourceAndExternalId(
    sourceSlug: string,
    externalId: string,
  ): Promise<{ listingId: string; job: ExistingJobSnapshot } | null> {
    const listing = [...this.listings.values()].find(
      (l) => l.sourceSlug === sourceSlug && l.externalId === externalId,
    );
    if (!listing) return null;
    const job = this.jobs.get(listing.jobId);
    if (!job) return null;
    return { listingId: listing.id, job };
  }

  async findDedupCandidates(companyName: string, normalizedTitle: string): Promise<ExistingJobSnapshot[]> {
    return [...this.jobs.values()].filter(
      (job) =>
        job.companyName.toLowerCase() === companyName.toLowerCase() &&
        job.normalizedTitle.toLowerCase() === normalizedTitle.toLowerCase(),
    );
  }

  async createJobWithListing(input: NewJobRecord): Promise<{ jobId: string; listingId: string }> {
    const job = this.seedJob({
      companyName: input.companyName,
      companySlug: input.companyName.toLowerCase().replace(/\s+/g, "-"),
      normalizedTitle: input.normalizedTitle,
      applyUrl: input.applyUrl,
      descriptionText: input.descriptionText,
      eligibleCountries: input.eligibleCountries,
      eligibleRegions: input.eligibleRegions,
      geographyConfidence: input.geographyConfidence,
      postedAt: input.postedAt,
      postedAtIsInferred: input.postedAtIsInferred,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency,
      salaryPeriod: input.salaryPeriod,
      employmentType: input.employmentType,
    });
    const listing = this.seedListing({
      jobId: job.id,
      sourceSlug: input.sourceSlug,
      externalId: input.externalId,
      sourceUrl: input.sourceUrl,
      applyUrl: input.applyUrl,
      postedAt: input.postedAt,
      postedAtIsInferred: input.postedAtIsInferred,
    });
    return { jobId: job.id, listingId: listing.id };
  }

  async upsertListingAndReconcileJob(input: ListingUpsertRecord): Promise<{ listingId: string }> {
    const job = this.jobs.get(input.jobId);
    if (!job) throw new Error(`Unknown job ${input.jobId}`);
    job.postedAt = input.reconciled.postedAt;
    job.postedAtIsInferred = input.reconciled.postedAtIsInferred;
    job.salaryMin = input.reconciled.salaryMin;
    job.salaryMax = input.reconciled.salaryMax;
    job.salaryCurrency = input.reconciled.salaryCurrency;
    job.salaryPeriod = input.reconciled.salaryPeriod;

    const existingListing = [...this.listings.values()].find(
      (l) => l.sourceSlug === input.sourceSlug && l.externalId === input.externalId,
    );
    if (existingListing) {
      existingListing.sourceUrl = input.sourceUrl;
      existingListing.applyUrl = input.applyUrl;
      existingListing.postedAt = input.postedAt;
      existingListing.postedAtIsInferred = input.postedAtIsInferred;
      return { listingId: existingListing.id };
    }

    const listing = this.seedListing({
      jobId: input.jobId,
      sourceSlug: input.sourceSlug,
      externalId: input.externalId,
      sourceUrl: input.sourceUrl,
      applyUrl: input.applyUrl,
      postedAt: input.postedAt,
      postedAtIsInferred: input.postedAtIsInferred,
    });
    return { listingId: listing.id };
  }

  async touchListingLastSeen(): Promise<void> {
    // no-op for tests — lastSeenAt isn't part of ExistingJobSnapshot
  }

  async touchListingsLastSeen(): Promise<void> {
    // no-op for tests; lastSeenAt is not part of ExistingJobSnapshot
  }
}
