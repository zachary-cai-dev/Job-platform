import { createPrismaClient } from "@euro-jobs/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestRawJobPayload } from "../../src/ingestRawJobPayload.js";
import { PrismaJobRepository } from "../../src/prismaJobRepository.js";
import type { RawJobInput } from "../../src/types.js";

/**
 * Exercises the real Prisma-backed repository against the live database (Supabase
 * in dev) — not run as part of `pnpm test` (see vitest.config.ts's exclude), only
 * via `pnpm test:integration`, since it needs network + DATABASE_URL. Everything it
 * creates is deleted in `afterAll`.
 *
 * Uses DIRECT_URL (session-mode pooler), not DATABASE_URL (transaction-mode) — the
 * write paths here run multi-statement `$transaction`s, which transaction-mode
 * PgBouncer can break outright (P2028 "Transaction not found"), confirmed for real
 * during apps/worker development. See packages/db/src/index.ts.
 */

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL must be set to run this integration test (see packages/db/.env.example).");
}

const SOURCE_SLUG = "greenhouse"; // reuse a real seeded Source row (FK requires one)
const TEST_TAG = `itest-${Date.now()}`;

const prisma = createPrismaClient(directUrl);
let ingestionRunId: string;
const repo = new PrismaJobRepository(prisma);

function input(overrides: Partial<RawJobInput> = {}): RawJobInput {
  return {
    sourceSlug: SOURCE_SLUG,
    externalId: `${TEST_TAG}-1`,
    sourceUrl: `https://example.test/${TEST_TAG}/1`,
    applyUrl: `https://example.test/${TEST_TAG}/1/apply`,
    companyName: `Integration Test Co ${TEST_TAG}`,
    rawTitle: "Senior Backend Engineer",
    rawLocation: "Remote - Germany, France",
    description: "<p>Stack: Go, PostgreSQL, Kubernetes. Salary: €90k - €110k.</p>",
    postedAt: new Date("2026-09-10T00:00:00Z"),
    rawPayload: { itest: TEST_TAG, v: 1 },
    ...overrides,
  };
}

beforeAll(async () => {
  const run = await prisma.ingestionRun.create({
    data: { sourceSlug: SOURCE_SLUG, status: "RUNNING" },
    select: { id: true },
  });
  ingestionRunId = run.id;
});

afterAll(async () => {
  const listings = await prisma.jobSourceListing.findMany({
    where: { externalId: { startsWith: TEST_TAG } },
    select: { id: true, jobId: true },
  });
  const jobIds = [...new Set(listings.map((l) => l.jobId))];

  await prisma.jobSourceListing.deleteMany({ where: { id: { in: listings.map((l) => l.id) } } });
  await prisma.jobTechnology.deleteMany({ where: { jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.company.deleteMany({ where: { name: { contains: TEST_TAG } } });
  await prisma.rawJob.deleteMany({ where: { externalId: { startsWith: TEST_TAG } } });
  await prisma.ingestionRun.delete({ where: { id: ingestionRunId } });
  await prisma.$disconnect();
});

describe("PrismaJobRepository + ingestRawJobPayload (live database)", () => {
  it("creates a real Job/Company/JobSourceListing row and populates the search vector", async () => {
    const outcome = await ingestRawJobPayload({ ingestionRunId, input: input(), repo });
    expect(outcome.kind).toBe("CREATED");
    expect(outcome.jobId).toBeDefined();

    const job = await prisma.job.findUniqueOrThrow({
      where: { id: outcome.jobId! },
      include: { company: true, technologies: true },
    });

    expect(job.normalizedTitle).toBe("Senior Backend Engineer");
    expect(job.company.name).toBe(`Integration Test Co ${TEST_TAG}`);
    expect(job.eligibleCountries.sort()).toEqual(["DE", "FR"]);
    expect(job.salaryMin).toBe(90000);
    expect(job.salaryMax).toBe(110000);
    expect(job.technologies.map((t) => t.technologySlug).sort()).toEqual(
      ["GOLANG", "KUBERNETES", "POSTGRESQL"].sort(),
    );

    const [searchRow] = await prisma.$queryRaw<Array<{ matches: boolean }>>`
      SELECT "searchVector" @@ to_tsquery('english', 'backend & kubernetes') AS matches
      FROM "jobs" WHERE id = ${job.id}
    `;
    expect(searchRow?.matches).toBe(true);
  });

  it("returns UNCHANGED on a byte-identical re-fetch and does not duplicate the job", async () => {
    // Distinct company from the other cases in this file — otherwise the real
    // cross-source dedup engine (correctly!) merges it into an earlier test's job,
    // since they'd share company+title+location+description.
    const distinctInput = input({
      externalId: `${TEST_TAG}-2`,
      companyName: `Integration Test Co ${TEST_TAG} Unchanged`,
      rawPayload: { itest: TEST_TAG, v: "unchanged-case" },
    });

    const first = await ingestRawJobPayload({ ingestionRunId, input: distinctInput, repo });
    expect(first.kind).toBe("CREATED");

    const second = await ingestRawJobPayload({ ingestionRunId, input: distinctInput, repo });
    expect(second.kind).toBe("UNCHANGED");

    const count = await prisma.job.count({
      where: { sourceListings: { some: { externalId: `${TEST_TAG}-2` } } },
    });
    expect(count).toBe(1);
  });

  it("publishes a US posting for the US remote feed", async () => {
    const outcome = await ingestRawJobPayload({
      ingestionRunId,
      input: input({ externalId: `${TEST_TAG}-3`, rawLocation: "US only" }),
      repo,
    });
    expect(outcome.kind).toBe("CREATED");

    const listing = await prisma.jobSourceListing.findFirst({
      where: { externalId: `${TEST_TAG}-3` },
    });
    expect(listing).not.toBeNull();
  });
});
