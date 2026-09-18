import { describe, expect, it } from "vitest";
import { buildOrderByClause, buildWhereClause } from "../src/postgresJobSearchService.js";
import type { JobSearchFilters } from "../src/types.js";

const NOW = new Date("2026-09-15T00:00:00Z");

describe("buildWhereClause", () => {
  it("always requires isActive = true, even with no filters", () => {
    const clause = buildWhereClause({}, NOW);
    expect(clause.sql).toContain('j."isActive" = true');
    expect(clause.values).toEqual([]);
  });

  it("binds the keyword query as a parameter, never interpolated into the SQL text", () => {
    const filters: JobSearchFilters = { q: "'; DROP TABLE jobs; --" };
    const clause = buildWhereClause(filters, NOW);
    expect(clause.sql).not.toContain("DROP TABLE");
    expect(clause.values).toContain("'; DROP TABLE jobs; --");
  });

  it("adds a company slug condition", () => {
    const clause = buildWhereClause({ companySlug: "acme" }, NOW);
    expect(clause.sql).toContain("c.slug =");
    expect(clause.values).toEqual(["acme"]);
  });

  it("adds a role category IN clause with bound values", () => {
    const clause = buildWhereClause({ roleCategory: ["BACKEND_ENGINEER", "FULL_STACK_ENGINEER"] }, NOW);
    expect(clause.sql).toContain('"roleCategorySlug" IN');
    expect(clause.values).toEqual(["BACKEND_ENGINEER", "FULL_STACK_ENGINEER"]);
  });

  it("adds an array-overlap condition for region", () => {
    const clause = buildWhereClause({ region: ["EU", "EEA"] }, NOW);
    expect(clause.sql).toContain('"eligibleRegions"');
    expect(clause.sql).toContain("&&");
    expect(clause.values).toEqual([["EU", "EEA"]]);
  });

  it("adds an array-overlap condition for country", () => {
    const clause = buildWhereClause({ country: ["DE", "FR"] }, NOW);
    expect(clause.sql).toContain('"eligibleCountries"');
    expect(clause.values).toEqual([["DE", "FR"]]);
  });

  it("matches either a country or a worldwide posting", () => {
    const clause = buildWhereClause({ countryOrWorldwide: ["US"] }, NOW);
    expect(clause.sql).toContain('j."eligibleCountries" &&');
    expect(clause.sql).toContain("WORLDWIDE");
    expect(clause.values).toEqual([["US"]]);
  });

  it("filters by remote type", () => {
    const clause = buildWhereClause({ remoteType: ["FULLY_REMOTE"] }, NOW);
    expect(clause.sql).toContain('j."remoteType"::text IN');
    expect(clause.values).toEqual(["FULLY_REMOTE"]);
  });

  it("adds an empty-eligibleCountries condition when regionOnly is set, with no bound values", () => {
    const clause = buildWhereClause({ regionOnly: true }, NOW);
    expect(clause.sql).toContain('array_length(j."eligibleCountries", 1) IS NULL');
    expect(clause.values).toEqual([]);
  });

  it("omits the regionOnly condition when it's false or unset", () => {
    expect(buildWhereClause({}, NOW).sql).not.toContain("array_length");
    expect(buildWhereClause({ regionOnly: false }, NOW).sql).not.toContain("array_length");
  });

  it("adds an EXISTS clause for technology filters", () => {
    const clause = buildWhereClause({ technology: ["REACT", "NODE_JS"] }, NOW);
    expect(clause.sql).toContain("EXISTS");
    expect(clause.sql).toContain("job_technologies");
    expect(clause.values).toEqual(["REACT", "NODE_JS"]);
  });

  it("computes a postedWithinHours cutoff relative to the injected now", () => {
    const clause = buildWhereClause({ postedWithinHours: 24 }, NOW);
    expect(clause.sql).toContain('"postedAt" >=');
    expect(clause.values).toEqual([new Date("2026-09-14T00:00:00Z")]);
  });

  it("adds salary range conditions", () => {
    const clause = buildWhereClause({ salaryMin: 50000, salaryMax: 120000 }, NOW);
    expect(clause.sql).toContain('"salaryMax" >=');
    expect(clause.sql).toContain('"salaryMin" <=');
    expect(clause.values).toEqual([50000, 120000]);
  });

  it("adds a NOT EXISTS clause for excluded sources", () => {
    const clause = buildWhereClause({ excludeSourceSlug: ["linkedin"] }, NOW);
    expect(clause.sql).toContain("NOT EXISTS");
    expect(clause.values).toEqual(["linkedin"]);
  });
});

describe("buildOrderByClause", () => {
  it("defaults to newest", () => {
    expect(buildOrderByClause("newest", undefined).sql).toContain('"postedAt" DESC');
  });

  it("oldest sorts ascending", () => {
    expect(buildOrderByClause("oldest", undefined).sql).toContain('"postedAt" ASC');
  });

  it("relevance ranks by ts_rank when a query is present", () => {
    const clause = buildOrderByClause("relevance", "typescript");
    expect(clause.sql).toContain("ts_rank");
    expect(clause.values).toContain("typescript");
  });

  it("relevance falls back to newest when there is no query", () => {
    const clause = buildOrderByClause("relevance", undefined);
    expect(clause.sql).not.toContain("ts_rank");
    expect(clause.sql).toContain('"postedAt" DESC');
  });

  it("salary_desc sorts by salaryMax descending, nulls last", () => {
    const clause = buildOrderByClause("salary_desc", undefined);
    expect(clause.sql).toContain('"salaryMax" DESC NULLS LAST');
  });

  it("salary_asc sorts by salaryMin ascending, nulls last", () => {
    const clause = buildOrderByClause("salary_asc", undefined);
    expect(clause.sql).toContain('"salaryMin" ASC NULLS LAST');
  });
});
