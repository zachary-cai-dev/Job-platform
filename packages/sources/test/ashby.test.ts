import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAshbyAdapter } from "../src/ashby/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/ashby-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("ashby adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Ashby jobs to the common RawJobPayload shape", async () => {
    const adapter = createAshbyAdapter({
      companies: [{ organizationSlug: "acme", companyName: "Acme Corp" }],
    });
    const result = await adapter.fetchJobs();

    expect(result.jobs).toHaveLength(2);
    const [first] = result.jobs;
    expect(first?.externalId).toBe("c3d4e5f6-2222-3333-4444-555566667777");
    expect(first?.rawTitle).toBe("Machine Learning Engineer");
    expect(first?.rawLocation).toBe("Remote EU");
    expect(first?.applyUrl).toBe("https://jobs.ashbyhq.com/acme/c3d4e5f6/application");
    expect(first?.companyName).toBe("Acme Corp");
    expect(first?.postedAt).toEqual(new Date("2026-09-11T08:00:00.000Z"));
  });

  it("falls back to jobUrl when applyUrl is absent", async () => {
    const adapter = createAshbyAdapter({
      companies: [{ organizationSlug: "acme", companyName: "Acme Corp" }],
    });
    const result = await adapter.fetchJobs();
    const [, second] = result.jobs;
    expect(second?.applyUrl).toBe("https://jobs.ashbyhq.com/acme/d4e5f6a7");
  });
});
