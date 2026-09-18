import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHimalayasAdapter } from "../src/himalayas/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/himalayas-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("himalayas adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps jobs to the common RawJobPayload shape, joining locationRestrictions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ...fixture, nextCursor: undefined }), { status: 200 })),
    );
    const adapter = createHimalayasAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(2);
    const [first, second] = result.jobs;
    expect(first?.externalId).toBe(fixture.jobs[0].guid);
    expect(first?.rawLocation).toBe("Germany, France");
    expect(first?.applyUrl).toBe(fixture.jobs[0].applicationLink);
    expect(first?.postedAt).toEqual(new Date(fixture.jobs[0].pubDate * 1000));
    // Empty locationRestrictions falls back to "Worldwide" rather than an empty string.
    expect(second?.rawLocation).toBe("Worldwide");
  });

  it("stops paging once maxPages is reached even if nextCursor keeps being returned", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createHimalayasAdapter({ maxPages: 3 });
    await adapter.fetchJobs();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops early once a page's jobs are older than the since option", async () => {
    const oldFixture = {
      ...fixture,
      jobs: fixture.jobs.map((job: { pubDate: number }) => ({ ...job, pubDate: 1000 })),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(oldFixture), { status: 200 })),
    );

    const adapter = createHimalayasAdapter({ maxPages: 5 });
    const result = await adapter.fetchJobs({ since: new Date("2026-01-01T00:00:00Z") });
    expect(result.jobs).toHaveLength(0);
  });
});
