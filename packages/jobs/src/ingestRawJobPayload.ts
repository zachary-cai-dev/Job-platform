import { DEFAULT_DEDUPLICATION_CONFIG, findBestMatch, type JobCandidate } from "@euro-jobs/deduplication";
import { evaluateEuropeanEligibility, type RegionCode } from "@euro-jobs/geography";
import { extractEmploymentType, extractSalary, extractTechnologies, normalizeTitle } from "@euro-jobs/normalization";
import { computeChecksum } from "./checksum.js";
import { computeFingerprint } from "./fingerprint.js";
import { reconcileJobFields } from "./reconciliation.js";
import { stripHtml } from "./stripHtml.js";
import type { ExistingJobSnapshot, IngestOutcome, JobRepositoryPort, NewJobRecord, RawJobInput } from "./types.js";

export interface IngestRawJobParams {
  ingestionRunId: string;
  input: RawJobInput;
  repo: JobRepositoryPort;
  /** Injected for deterministic tests; defaults to the real clock. */
  now?: () => Date;
}

const REGION_DISPLAY_PRIORITY: RegionCode[] = ["EU", "EEA", "EMEA", "EUROPE"];

function buildLocationDisplay(regions: RegionCode[], countries: string[]): string {
  if (regions.includes("WORLDWIDE")) return "Remote (Worldwide)";
  const preferredRegion = REGION_DISPLAY_PRIORITY.find((region) => regions.includes(region));
  if (preferredRegion) return `Remote (${preferredRegion})`;
  if (countries.length > 0) return `Remote (${countries.join(", ")})`;
  return "Remote";
}

/**
 * The full per-job pipeline (docs/ingestion.md §1): raw upsert → normalize →
 * geography → dedup → create-or-merge. Depends only on `JobRepositoryPort`, never
 * on Prisma directly, so this is testable with an in-memory fake repo — see
 * test/ingestRawJobPayload.test.ts.
 */
export async function ingestRawJobPayload(params: IngestRawJobParams): Promise<IngestOutcome> {
  const { ingestionRunId, input, repo } = params;
  const now = params.now ?? (() => new Date());

  const checksum = computeChecksum(input.rawPayload);
  const rawJobUpsert = await repo.upsertRawJob({ ...input, ingestionRunId, checksum });

  if (!rawJobUpsert.isNewOrChanged) {
    await repo.touchListingLastSeen(input.sourceSlug, input.externalId, now());
    return { kind: "UNCHANGED", rawJobId: rawJobUpsert.rawJobId };
  }

  const titleResult = normalizeTitle(input.rawTitle);

  // A company's ATS board lists every open req — Sales, Legal, Support, Marketing —
  // not just engineering ones. This product is scoped to tech roles specifically
  // (brief §1), so anything that doesn't match a known role category is rejected
  // outright rather than landing in the feed tagged "OTHER" (checked before the
  // pricier geography evaluation, since it's a cheaper, more fundamental gate).
  if (titleResult.roleCategory === "OTHER") {
    await repo.markRawJobStatus(rawJobUpsert.rawJobId, "REJECTED_ROLE_CATEGORY");
    return { kind: "REJECTED_ROLE_CATEGORY", rawJobId: rawJobUpsert.rawJobId };
  }

  const descriptionText = stripHtml(input.description);
  const technologies = extractTechnologies(input.rawTitle, descriptionText);
  const employmentType = input.employmentType ?? extractEmploymentType(input.rawTitle, descriptionText);
  const extractedSalary = extractSalary(descriptionText);
  const salary = {
    salaryMin: input.salaryMin ?? extractedSalary.salaryMin,
    salaryMax: input.salaryMax ?? extractedSalary.salaryMax,
    salaryCurrency: input.salaryCurrency ?? extractedSalary.salaryCurrency,
    salaryPeriod: input.salaryPeriod ?? extractedSalary.salaryPeriod,
  };

  const geography = evaluateEuropeanEligibility({
    locationRaw: input.rawLocation,
    title: input.rawTitle,
    descriptionText,
  });

  if (!geography.eligible) {
    await repo.markRawJobStatus(rawJobUpsert.rawJobId, "REJECTED_GEOGRAPHY");
    return { kind: "REJECTED_GEOGRAPHY", rawJobId: rawJobUpsert.rawJobId, geography };
  }

  const locationDisplay = buildLocationDisplay(geography.eligibleRegions, geography.eligibleCountries);
  const fingerprint = computeFingerprint(input.companyName, titleResult.normalizedTitle, locationDisplay);
  const incomingSalary = {
    postedAt: input.postedAt ?? null,
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    salaryCurrency: salary.salaryCurrency,
    salaryPeriod: salary.salaryPeriod,
  };

  // Case 1: this exact (source, externalId) listing is already known — an update to
  // a known posting, not a fresh dedup decision (docs/ingestion.md §7.1 point 2).
  const existingListing = await repo.findListingBySourceAndExternalId(input.sourceSlug, input.externalId);
  if (existingListing) {
    const reconciled = reconcileJobFields(existingListing.job, incomingSalary, now());
    const result = await repo.upsertListingAndReconcileJob({
      jobId: existingListing.job.id,
      sourceSlug: input.sourceSlug,
      externalId: input.externalId,
      sourceUrl: input.sourceUrl,
      applyUrl: input.applyUrl,
      postedAt: reconciled.postedAt,
      postedAtIsInferred: reconciled.postedAtIsInferred,
      reconciled,
    });
    await repo.markRawJobStatus(rawJobUpsert.rawJobId, "PUBLISHED");
    return {
      kind: "UPDATED_EXISTING_LISTING",
      rawJobId: rawJobUpsert.rawJobId,
      jobId: existingListing.job.id,
      listingId: result.listingId,
      geography,
    };
  }

  // Case 2: a genuinely new (source, externalId) — run real cross-source dedup.
  const candidates = await repo.findDedupCandidates(input.companyName, titleResult.normalizedTitle);
  const incomingCandidate: JobCandidate = {
    id: "__incoming__",
    companyName: input.companyName,
    normalizedTitle: titleResult.normalizedTitle,
    applyUrl: input.applyUrl,
    descriptionText,
    eligibleCountries: geography.eligibleCountries,
    eligibleRegions: geography.eligibleRegions,
    geographyConfidence: geography.confidence,
  };

  const decision = findBestMatch(incomingCandidate, candidates, DEFAULT_DEDUPLICATION_CONFIG);

  if (decision.action === "MERGE" && decision.matchedCandidateId) {
    const matched = candidates.find(
      (candidate): candidate is ExistingJobSnapshot => candidate.id === decision.matchedCandidateId,
    );
    if (!matched) {
      throw new Error(`Dedup matched candidate id ${decision.matchedCandidateId} was not in the candidate set`);
    }

    const reconciled = reconcileJobFields(matched, incomingSalary, now());
    const result = await repo.upsertListingAndReconcileJob({
      jobId: matched.id,
      sourceSlug: input.sourceSlug,
      externalId: input.externalId,
      sourceUrl: input.sourceUrl,
      applyUrl: input.applyUrl,
      postedAt: reconciled.postedAt,
      postedAtIsInferred: reconciled.postedAtIsInferred,
      reconciled,
    });
    await repo.markRawJobStatus(rawJobUpsert.rawJobId, "MERGED_DUPLICATE");
    return {
      kind: "MERGED",
      rawJobId: rawJobUpsert.rawJobId,
      jobId: matched.id,
      listingId: result.listingId,
      geography,
      reason: decision.reasons.join("; "),
    };
  }

  const postedAt = input.postedAt ?? now();
  const postedAtIsInferred = !input.postedAt;

  const newJobRecord: NewJobRecord = {
    sourceSlug: input.sourceSlug,
    externalId: input.externalId,
    sourceUrl: input.sourceUrl,
    applyUrl: input.applyUrl,
    companyName: input.companyName,
    companyUrl: input.companyUrl,
    title: input.rawTitle,
    normalizedTitle: titleResult.normalizedTitle,
    roleCategorySlug: titleResult.roleCategory,
    seniority: titleResult.seniority,
    tags: titleResult.tags,
    description: input.description,
    descriptionText,
    locationRaw: input.rawLocation,
    locationDisplay,
    remoteType: input.remoteType ?? "FULLY_REMOTE",
    eligibleCountries: geography.eligibleCountries,
    eligibleRegions: geography.eligibleRegions,
    geographyConfidence: geography.confidence,
    geographyReason: geography.reason,
    employmentType,
    salaryMin: salary.salaryMin,
    salaryMax: salary.salaryMax,
    salaryCurrency: salary.salaryCurrency,
    salaryPeriod: salary.salaryPeriod,
    skills: [],
    technologySlugs: technologies.map((tech) => tech.slug),
    postedAt,
    postedAtIsInferred,
    fingerprint,
  };

  const created = await repo.createJobWithListing(newJobRecord);
  await repo.markRawJobStatus(rawJobUpsert.rawJobId, "PUBLISHED");
  return {
    kind: "CREATED",
    rawJobId: rawJobUpsert.rawJobId,
    jobId: created.jobId,
    listingId: created.listingId,
    geography,
  };
}
