import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJobgetherAdapter } from "../src/jobgether/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/jobgether-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("jobgether adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps jobs to the common RawJobPayload shape", async () => {
    const adapter = createJobgetherAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(2);
    const [first] = result.jobs;
    expect(first?.externalId).toBe("65f1a2b3c4d5e6f7a8b9c0d1");
    expect(first?.rawTitle).toBe("Senior Frontend Developer");
    expect(first?.rawLocation).toBe("Spain, France");
    expect(first?.companyName).toBe("Acme Inc.");
    expect(first?.sourceUrl).toBe(first?.applyUrl);
    expect(first?.description).toContain("Salary: 60000-80000 EUR");
    expect(first?.description).toContain("Job function: Frontend Developer");
    expect(first?.postedAt).toEqual(new Date("2026-09-16T15:31:29.957Z"));
  });

  it("stops paging once hasMore is false", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createJobgetherAdapter({ maxPages: 5 });
    await adapter.fetchJobs();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes the locations filter through as a query param", async () => {
    const adapter = createJobgetherAdapter({ locations: ["europe"] });
    await adapter.fetchJobs();
    const [requestedUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(requestedUrl).toContain("locations=europe");
    expect(requestedUrl).toContain("sort=date");
  });
});
