import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGermanTechJobsAdapter } from "../src/germantechjobs/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/germantechjobs-sample.rss", import.meta.url));
const fixture = readFileSync(fixturePath, "utf-8");

describe("germantechjobs adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses 'Title @ Company [salary]' titles, extracting the bracketed salary", async () => {
    const adapter = createGermanTechJobsAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(2);
    const [first] = result.jobs;
    expect(first?.rawTitle).toBe("Senior IT Consultant HR Digitalisierung (all genders)");
    expect(first?.companyName).toBe("adesso SE");
    expect(first?.description).toContain("Salary: 45.000 - 75.000 €");
    expect(first?.rawLocation).toBe("Germany");
    expect(first?.postedAt).toEqual(new Date("Tue, 15 Sep 2026 15:56:49 GMT"));
  });

  it("handles titles without a bracketed salary", async () => {
    const adapter = createGermanTechJobsAdapter();
    const result = await adapter.fetchJobs();
    const [, second] = result.jobs;
    expect(second?.rawTitle).toBe("Backend Engineer");
    expect(second?.companyName).toBe("Small Startup GmbH");
  });
});
