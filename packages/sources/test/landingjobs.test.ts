import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLandingJobsAdapter } from "../src/landingjobs/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/landingjobs-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("landingjobs adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps jobs, deriving the company name from the /at/<slug>/ URL segment", async () => {
    const adapter = createLandingJobsAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.externalId).toBe("19066");
    expect(first?.rawTitle).toBe("Senior Java Software Developer");
    expect(first?.companyName).toBe("Inscale");
    expect(first?.rawLocation).toBe("Lisbon, PT");
    expect(first?.description).toContain("global retail chain");
    expect(first?.description).toContain("Kafka");
    expect(first?.postedAt).toEqual(new Date("2026-08-02T00:00:00Z"));
  });
});
