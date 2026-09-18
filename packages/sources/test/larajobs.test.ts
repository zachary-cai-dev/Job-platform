import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLaraJobsAdapter } from "../src/larajobs/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/larajobs-sample.rss", import.meta.url));
const fixture = readFileSync(fixturePath, "utf-8");

describe("larajobs adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the job:* namespaced fields and synthesizes a description, since <description> is always empty", async () => {
    const adapter = createLaraJobsAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.rawTitle).toBe("Lead Developer — Rebuild, Modernize, & Scale (Remote)");
    expect(first?.companyName).toBe("Track it Forward");
    expect(first?.rawLocation).toBe("Remote / USA / Canada");
    expect(first?.sourceUrl).toBe("https://larajobs.com/job/3934");
    expect(first?.description).toContain("Employment type: FULL TIME");
    expect(first?.description).toContain("Salary: Competitive");
    expect(first?.postedAt).toEqual(new Date("Mon, 14 Sep 2026 22:10:10 +0000"));
  });
});
