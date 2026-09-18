import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRemotiveAdapter } from "../src/remotive/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/remotive-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("remotive adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps both jobs to the common RawJobPayload shape", async () => {
    const adapter = createRemotiveAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(2);
  });

  it("folds salary and job type into the description and uses Remotive's own URL for both links", async () => {
    const adapter = createRemotiveAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.externalId).toBe("1680495");
    expect(first?.rawTitle).toBe("Senior Backend Engineer");
    expect(first?.rawLocation).toBe("Europe");
    expect(first?.companyName).toBe("Acme Corp");
    expect(first?.sourceUrl).toBe(first?.applyUrl);
    expect(first?.description).toContain("Salary: $70k - $100k");
    expect(first?.description).toContain("Employment type: Full-time");
    expect(first?.postedAt).toEqual(new Date("2026-09-11T20:16:48"));
  });

  it("passes a category query param through to the request URL", async () => {
    const adapter = createRemotiveAdapter({ category: "software-dev" });
    await adapter.fetchJobs();
    const [requestedUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(requestedUrl).toContain("category=software-dev");
  });
});
