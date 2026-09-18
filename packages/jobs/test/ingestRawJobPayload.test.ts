import { describe, expect, it } from "vitest";
import { ingestRawJobPayload } from "../src/ingestRawJobPayload.js";
import type { RawJobInput } from "../src/types.js";
import { FakeJobRepository } from "./fakeRepository.js";

function baseInput(overrides: Partial<RawJobInput> = {}): RawJobInput {
  return {
    sourceSlug: "greenhouse",
    externalId: "12345",
    sourceUrl: "https://boards.greenhouse.io/acme/jobs/12345",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/12345",
    companyName: "Acme Corp",
    rawTitle: "Senior Backend Engineer",
    rawLocation: "Remote - Germany, France, Netherlands",
    description: "<p>Join our platform team working with Go, PostgreSQL and Kubernetes.</p>",
    postedAt: new Date("2026-09-10T00:00:00Z"),
    rawPayload: { id: 12345 },
    ...overrides,
  };
}

const FIXED_NOW = new Date("2026-09-15T00:00:00Z");

describe("ingestRawJobPayload — geography rejection", () => {
  it("publishes a US-only posting for the US remote feed", async () => {
    const repo = new FakeJobRepository();
    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({ rawLocation: "US only", externalId: "us-only-1" }),
      repo,
      now: () => FIXED_NOW,
    });

    expect(outcome.kind).toBe("CREATED");
    expect(outcome.geography?.eligibleCountries).toEqual(["US"]);
    expect(repo.jobs.size).toBe(1);
    expect(repo.rawJobs[0]?.status).toBe("PUBLISHED");
  });
});

describe("ingestRawJobPayload — non-tech role rejection", () => {
  it("rejects a title that matches no known tech role category, before evaluating geography", async () => {
    // Real-world case: a company's ATS board lists every open req, not just
    // engineering ones — a Sales/Legal/Support/Marketing posting must not land in
    // the tech jobs feed just because it happens to be Europe-eligible.
    const repo = new FakeJobRepository();
    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({
        externalId: "sales-role-1",
        rawTitle: "Commercial Account Executive - DACH",
        rawLocation: "Remote - Germany",
      }),
      repo,
      now: () => FIXED_NOW,
    });

    expect(outcome.kind).toBe("REJECTED_ROLE_CATEGORY");
    expect(outcome.geography).toBeUndefined(); // never reached the geography step
    expect(repo.jobs.size).toBe(0);
    expect(repo.rawJobs[0]?.status).toBe("REJECTED_ROLE_CATEGORY");
  });
});

describe("ingestRawJobPayload — new job creation", () => {
  it("creates a canonical job + listing for a fresh, eligible posting", async () => {
    const repo = new FakeJobRepository();
    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput(),
      repo,
      now: () => FIXED_NOW,
    });

    expect(outcome.kind).toBe("CREATED");
    expect(outcome.jobId).toBeDefined();
    const job = repo.jobs.get(outcome.jobId!);
    expect(job?.normalizedTitle).toBe("Senior Backend Engineer");
    expect(job?.eligibleCountries.sort()).toEqual(["DE", "FR", "NL"]);
    expect(job?.postedAt).toEqual(new Date("2026-09-10T00:00:00Z"));
    expect(job?.postedAtIsInferred).toBe(false);
    expect(repo.rawJobs[0]?.status).toBe("PUBLISHED");
  });

  it("falls back to firstDiscoveredAt (now) and flags postedAtIsInferred when the source gives no date", async () => {
    const repo = new FakeJobRepository();
    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({ postedAt: undefined, externalId: "no-date-1" }),
      repo,
      now: () => FIXED_NOW,
    });

    const job = repo.jobs.get(outcome.jobId!);
    expect(job?.postedAt).toEqual(FIXED_NOW);
    expect(job?.postedAtIsInferred).toBe(true);
  });

  it("extracts salary from the description", async () => {
    const repo = new FakeJobRepository();
    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({
        externalId: "with-salary-1",
        description: "<p>Stack: Go, Kubernetes, PostgreSQL. Salary: €80k - €100k.</p>",
      }),
      repo,
      now: () => FIXED_NOW,
    });

    const job = repo.jobs.get(outcome.jobId!);
    expect(job?.salaryMin).toBe(80000);
    expect(job?.salaryMax).toBe(100000);
    expect(job?.salaryCurrency).toBe("EUR");
  });

  it("prefers structured ATS employment and salary fields over free-text inference", async () => {
    const repo = new FakeJobRepository();
    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({
        externalId: "structured-fields-1",
        description: "<p>Salary: $10 - $20 hourly. Contract role.</p>",
        employmentType: "PERMANENT",
        salaryMin: 80000,
        salaryMax: 100000,
        salaryCurrency: "GBP",
        salaryPeriod: "YEARLY",
      }),
      repo,
      now: () => FIXED_NOW,
    });

    const job = repo.jobs.get(outcome.jobId!);
    expect(job?.employmentType).toBe("PERMANENT");
    expect(job?.salaryMin).toBe(80000);
    expect(job?.salaryMax).toBe(100000);
    expect(job?.salaryCurrency).toBe("GBP");
    expect(job?.salaryPeriod).toBe("YEARLY");
  });

  it("retries a raw job stuck at PENDING instead of treating it as already-handled", async () => {
    // Regression test: a previous attempt captured the RawJob row (checksum
    // recorded) but crashed before reaching a terminal status — e.g. the real
    // PgBouncer transaction-mode incompatibility hit during worker development.
    // An identical re-fetch must still turn it into a Job, not silently no-op.
    const repo = new FakeJobRepository();
    const input = baseInput({ externalId: "stuck-pending-1" });

    repo.rawJobs.push({
      id: "raw-stuck",
      sourceSlug: input.sourceSlug,
      externalId: input.externalId,
      checksum: "will-not-match", // placeholder; replaced below with the real one
      status: "PENDING",
    });
    // Compute the real checksum the same way the orchestrator does, so the fake's
    // seeded row actually matches on re-fetch.
    const { computeChecksum } = await import("../src/checksum.js");
    repo.rawJobs[0]!.checksum = computeChecksum(input.rawPayload);

    const outcome = await ingestRawJobPayload({ ingestionRunId: "run-1", input, repo, now: () => FIXED_NOW });

    expect(outcome.kind).toBe("CREATED");
    expect(repo.jobs.size).toBe(1);
    expect(repo.rawJobs[0]?.status).toBe("PUBLISHED");
  });
});

describe("ingestRawJobPayload — same listing seen again", () => {
  it("returns UNCHANGED and does not reprocess when the raw payload is byte-identical", async () => {
    const repo = new FakeJobRepository();
    const input = baseInput({ externalId: "repeat-1" });

    const first = await ingestRawJobPayload({ ingestionRunId: "run-1", input, repo, now: () => FIXED_NOW });
    expect(first.kind).toBe("CREATED");

    const second = await ingestRawJobPayload({ ingestionRunId: "run-2", input, repo, now: () => FIXED_NOW });
    expect(second.kind).toBe("UNCHANGED");
    expect(repo.jobs.size).toBe(1); // no duplicate job created
  });

  it("updates the existing listing in place when the same (source, externalId) posting changes", async () => {
    const repo = new FakeJobRepository();
    const input = baseInput({ externalId: "edited-1", rawPayload: { id: "edited-1", v: 1 } });

    const first = await ingestRawJobPayload({ ingestionRunId: "run-1", input, repo, now: () => FIXED_NOW });
    expect(first.kind).toBe("CREATED");

    const editedInput = baseInput({
      externalId: "edited-1",
      rawPayload: { id: "edited-1", v: 2 }, // different checksum
      description: "<p>Updated: Go, PostgreSQL, and now Kafka too.</p>",
    });
    const second = await ingestRawJobPayload({
      ingestionRunId: "run-2",
      input: editedInput,
      repo,
      now: () => FIXED_NOW,
    });

    expect(second.kind).toBe("UPDATED_EXISTING_LISTING");
    expect(second.jobId).toBe(first.jobId);
    expect(repo.jobs.size).toBe(1);
  });
});

describe("ingestRawJobPayload — cross-source deduplication", () => {
  it("merges into an existing job discovered via a different source", async () => {
    const repo = new FakeJobRepository();
    const existingJob = repo.seedJob({
      companyName: "Acme Corp",
      companySlug: "acme-corp",
      normalizedTitle: "Senior Backend Engineer",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/12345",
      descriptionText: "Join our platform team working with Go, PostgreSQL and Kubernetes.",
      eligibleCountries: ["DE", "FR", "NL"],
      eligibleRegions: ["EU", "EEA", "EUROPE", "EMEA"],
      geographyConfidence: "HIGH",
      postedAt: new Date("2026-09-05T00:00:00Z"),
      postedAtIsInferred: false,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });

    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({
        sourceSlug: "linkedin",
        externalId: "li-98765",
        applyUrl: "https://www.linkedin.com/jobs/view/98765",
        sourceUrl: "https://www.linkedin.com/jobs/view/98765",
        description:
          "<p>Join our platform team working with Go, PostgreSQL and Kubernetes to build reliable APIs.</p>",
        postedAt: new Date("2026-09-12T00:00:00Z"), // later than existing's real date
        rawPayload: { id: "li-98765" },
      }),
      repo,
      now: () => FIXED_NOW,
    });

    expect(outcome.kind).toBe("MERGED");
    expect(outcome.jobId).toBe(existingJob.id);
    // earliest real postedAt wins — existing's date, not the later incoming one
    const job = repo.jobs.get(existingJob.id)!;
    expect(job.postedAt).toEqual(new Date("2026-09-05T00:00:00Z"));
    expect(repo.jobs.size).toBe(1);
    expect(repo.listings.size).toBe(1);
  });

  it("does not merge when locations are materially different (narrow, disjoint)", async () => {
    const repo = new FakeJobRepository();
    repo.seedJob({
      companyName: "Acme Corp",
      companySlug: "acme-corp",
      normalizedTitle: "Senior Backend Engineer",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/11111",
      descriptionText: "Join our Berlin-based platform team.",
      eligibleCountries: ["DE"],
      eligibleRegions: ["EU", "EEA", "EUROPE", "EMEA"],
      geographyConfidence: "HIGH",
      postedAt: new Date("2026-09-01T00:00:00Z"),
      postedAtIsInferred: false,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });

    const outcome = await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({
        sourceSlug: "lever",
        externalId: "lever-1",
        rawLocation: "Remote - Spain",
        rawPayload: { id: "lever-1" },
      }),
      repo,
      now: () => FIXED_NOW,
    });

    expect(outcome.kind).toBe("CREATED");
    expect(repo.jobs.size).toBe(2);
  });

  it("fills in salary on merge only when the canonical job doesn't already have it", async () => {
    const repo = new FakeJobRepository();
    const existingJob = repo.seedJob({
      companyName: "Acme Corp",
      companySlug: "acme-corp",
      normalizedTitle: "Senior Backend Engineer",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/12345",
      descriptionText: "Join our platform team working with Go, PostgreSQL and Kubernetes.",
      eligibleCountries: ["DE"],
      eligibleRegions: ["EU", "EEA", "EUROPE", "EMEA"],
      geographyConfidence: "HIGH",
      postedAt: new Date("2026-09-05T00:00:00Z"),
      postedAtIsInferred: false,
      salaryMin: 70000,
      salaryMax: 90000,
      salaryCurrency: "EUR",
      salaryPeriod: "YEARLY",
    });

    await ingestRawJobPayload({
      ingestionRunId: "run-1",
      input: baseInput({
        sourceSlug: "lever",
        externalId: "lever-2",
        rawLocation: "Remote - Germany",
        description: "<p>Salary: €150k - €200k. Same role as before.</p>",
        rawPayload: { id: "lever-2" },
      }),
      repo,
      now: () => FIXED_NOW,
    });

    const job = repo.jobs.get(existingJob.id)!;
    // existing salary must NOT be clobbered by the new listing's figure
    expect(job.salaryMin).toBe(70000);
    expect(job.salaryMax).toBe(90000);
  });
});
