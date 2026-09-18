import type { JobCandidate } from "@euro-jobs/deduplication";
import type { EligibilityResult, GeographyConfidence, RegionCode } from "@euro-jobs/geography";
import type { EmploymentType, Seniority, SalaryPeriod } from "@euro-jobs/normalization";

export type ProcessingStatus =
  | "PENDING"
  | "NORMALIZED"
  | "EUROPE_ELIGIBLE"
  | "REJECTED_GEOGRAPHY"
  | "REJECTED_ROLE_CATEGORY"
  | "MERGED_DUPLICATE"
  | "PUBLISHED"
  | "FAILED";

export type RemoteType = "FULLY_REMOTE" | "HYBRID" | "UNKNOWN";

export interface RawJobInput {
  sourceSlug: string;
  externalId: string;
  sourceUrl: string;
  applyUrl: string;
  companyName: string;
  companyUrl?: string;
  rawTitle: string;
  rawLocation?: string;
  /** Original description as provided — HTML or plain text. */
  description: string;
  postedAt?: Date;
  remoteType?: RemoteType;
  employmentType?: EmploymentType;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  rawPayload: unknown;
}

export interface UpsertRawJobInput extends RawJobInput {
  ingestionRunId: string;
  checksum: string;
}

export interface UpsertRawJobResult {
  rawJobId: string;
  /** false when a RawJob row with this exact (source, externalId, checksum) already exists. */
  isNewOrChanged: boolean;
}

/**
 * Everything the reconciliation/dedup logic needs about an already-canonical Job —
 * a superset of `JobCandidate` (packages/deduplication's minimal scoring shape) so
 * it can be passed anywhere a `JobCandidate` is expected.
 */
export interface ExistingJobSnapshot extends JobCandidate {
  postedAt: Date | null;
  postedAtIsInferred: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}

export interface ReconciledJobFields {
  postedAt: Date;
  postedAtIsInferred: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}

export interface NewJobRecord {
  sourceSlug: string;
  externalId: string;
  sourceUrl: string;
  applyUrl: string;
  companyName: string;
  companyUrl?: string;
  title: string;
  normalizedTitle: string;
  roleCategorySlug: string;
  seniority: Seniority | null;
  tags: string[];
  description: string;
  descriptionText: string;
  locationRaw: string | undefined;
  locationDisplay: string;
  remoteType: RemoteType;
  eligibleCountries: string[];
  eligibleRegions: RegionCode[];
  geographyConfidence: GeographyConfidence;
  geographyReason: string;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  skills: string[];
  technologySlugs: string[];
  postedAt: Date;
  postedAtIsInferred: boolean;
  fingerprint: string;
}

export interface ListingUpsertRecord {
  jobId: string;
  sourceSlug: string;
  externalId: string;
  sourceUrl: string;
  applyUrl: string;
  postedAt: Date;
  postedAtIsInferred: boolean;
  reconciled: ReconciledJobFields;
}

/**
 * Everything `ingestRawJobPayload` needs from persistence, as a port — the pure
 * orchestration logic depends only on this interface, never directly on
 * `packages/db`/Prisma, so it's fully unit-testable with an in-memory fake. See
 * `prismaJobRepository.ts` for the concrete implementation used by `apps/worker`.
 */
export interface JobRepositoryPort {
  upsertRawJob(input: UpsertRawJobInput): Promise<UpsertRawJobResult>;
  markRawJobStatus(rawJobId: string, status: ProcessingStatus, error?: string): Promise<void>;
  findListingBySourceAndExternalId(
    sourceSlug: string,
    externalId: string,
  ): Promise<{ listingId: string; job: ExistingJobSnapshot } | null>;
  findDedupCandidates(companyName: string, normalizedTitle: string): Promise<ExistingJobSnapshot[]>;
  createJobWithListing(input: NewJobRecord): Promise<{ jobId: string; listingId: string }>;
  upsertListingAndReconcileJob(input: ListingUpsertRecord): Promise<{ listingId: string }>;
  touchListingLastSeen(sourceSlug: string, externalId: string, now: Date): Promise<void>;
  touchListingsLastSeen(sourceSlug: string, externalIds: string[], now: Date): Promise<void>;
}

export type IngestOutcomeKind =
  | "UNCHANGED"
  | "REJECTED_GEOGRAPHY"
  | "REJECTED_ROLE_CATEGORY"
  | "CREATED"
  | "MERGED"
  | "UPDATED_EXISTING_LISTING";

export interface IngestOutcome {
  kind: IngestOutcomeKind;
  rawJobId: string;
  jobId?: string;
  listingId?: string;
  geography?: EligibilityResult;
  reason?: string;
}
