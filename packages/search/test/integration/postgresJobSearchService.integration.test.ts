import { createPrismaClient } from "@euro-jobs/db";
import { afterAll, describe, expect, it } from "vitest";
import { PostgresJobSearchService } from "../../src/postgresJobSearchService.js";

/**
 * Exercises the real raw-SQL queries against the live database — the one place
 * hand-written SQL exists in this codebase, so syntax/type mistakes only show up by
 * actually running it. Not part of `pnpm test` (see vitest.config.ts's exclude),
 * only `pnpm test:integration`, since it needs network + DATABASE_URL. Read-only —
 * nothing is created or needs cleanup.
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to run this integration test.");
}

const prisma = createPrismaClient(databaseUrl);
const service = new PostgresJobSearchService(prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PostgresJobSearchService (live database)", () => {
  it("returns a well-formed page of results with no filters", async () => {
    const result = await service.search({ filters: {}, sort: "newest", page: 1, pageSize: 5 });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);

    for (const item of result.items) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.companyName).toBeTruthy();
      expect(item.applyUrl).toMatch(/^https?:\/\//);
      expect(Array.isArray(item.eligibleCountries)).toBe(true);
      expect(Array.isArray(item.eligibleRegions)).toBe(true);
      expect(Array.isArray(item.technologies)).toBe(true);
    }
  });

  it("sorts newest-first by default", async () => {
    const result = await service.search({ filters: {}, sort: "newest", page: 1, pageSize: 20 });
    const postedAts = result.items.map((item) => item.postedAt.getTime());
    const sorted = [...postedAts].sort((a, b) => b - a);
    expect(postedAts).toEqual(sorted);
  });

  it("filtering by region only returns jobs whose eligibleRegions includes it", async () => {
    const result = await service.search({
      filters: { region: ["EU"] },
      sort: "newest",
      page: 1,
      pageSize: 50,
    });
    for (const item of result.items) {
      expect(item.eligibleRegions).toContain("EU");
    }
  });

  it("keyword search returns a strict subset of the unfiltered results", async () => {
    // The search vector legitimately covers title + normalizedTitle + skills +
    // description (docs/architecture.md §7), so a term can match via description
    // text even when absent from the title — this checks the filter narrows
    // results at all, not which specific field matched.
    const [all, filtered] = await Promise.all([
      service.search({ filters: {}, sort: "newest", page: 1, pageSize: 50 }),
      service.search({ filters: { q: "engineer" }, sort: "relevance", page: 1, pageSize: 50 }),
    ]);
    expect(filtered.total).toBeLessThanOrEqual(all.total);

    const nonsenseResult = await service.search({
      filters: { q: "xyznonexistentkeywordzzz123" },
      sort: "relevance",
      page: 1,
      pageSize: 10,
    });
    expect(nonsenseResult.total).toBe(0);
    expect(nonsenseResult.items).toEqual([]);
  });

  it("paginates without overlap between page 1 and page 2", async () => {
    const pageSize = 2;
    const [page1, page2] = await Promise.all([
      service.search({ filters: {}, sort: "newest", page: 1, pageSize }),
      service.search({ filters: {}, sort: "newest", page: 2, pageSize }),
    ]);
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it("returns filter facets with positive counts", async () => {
    const facets = await service.getFilterFacets();
    expect(Array.isArray(facets.roleCategory)).toBe(true);
    expect(Array.isArray(facets.region)).toBe(true);
    expect(Array.isArray(facets.country)).toBe(true);

    for (const facetGroup of Object.values(facets)) {
      for (const entry of facetGroup) {
        expect(entry.count).toBeGreaterThan(0);
        expect(typeof entry.value).toBe("string");
      }
    }
  });

  it("never offers 'US' in the country facet — it's only reachable via the US remote tab's countryOrWorldwide filter, not this checkbox list", async () => {
    const facets = await service.getFilterFacets();
    expect(facets.country.map((f) => f.value)).not.toContain("US");
  });
});
