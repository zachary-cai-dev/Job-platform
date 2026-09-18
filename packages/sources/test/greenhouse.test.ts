import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGreenhouseAdapter } from "../src/greenhouse/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/greenhouse-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("greenhouse adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Greenhouse jobs to the common RawJobPayload shape", async () => {
    const adapter = createGreenhouseAdapter({
      companies: [{ boardToken: "acme", companyName: "Acme Corp" }],
    });
    const result = await adapter.fetchJobs();

    expect(result.jobs).toHaveLength(2);

    const [first] = result.jobs;
    expect(first?.externalId).toBe("5012345");
    expect(first?.rawTitle).toBe("Senior Backend Engineer");
    expect(first?.sourceUrl).toBe("https://boards.greenhouse.io/acme/jobs/5012345");
    expect(first?.applyUrl).toBe(first?.sourceUrl);
    expect(first?.rawLocation).toBe("Remote - Germany, France, Netherlands");
    expect(first?.companyName).toBe("Acme Corp");
    expect(first?.description).toContain("Senior Backend Engineer");
    expect(first?.postedAt).toBeInstanceOf(Date);
    expect(first?.rawPayload).toEqual(fixture.jobs[0]);
  });

  it("falls back to the office name when location.name is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jobs: [
                {
                  id: 1,
                  title: "Engineer",
                  updated_at: "2026-01-01T00:00:00Z",
                  absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
                  offices: [{ name: "Remote EMEA" }],
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );

    const adapter = createGreenhouseAdapter({
      companies: [{ boardToken: "acme", companyName: "Acme Corp" }],
    });
    const result = await adapter.fetchJobs();
    expect(result.jobs[0]?.rawLocation).toBe("Remote EMEA");
  });

  it("queries every configured board token", async () => {
    const fetchSpy = vi.fn(async (_url: string) => new Response(JSON.stringify({ jobs: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const adapter = createGreenhouseAdapter({
      companies: [
        { boardToken: "acme", companyName: "Acme Corp" },
        { boardToken: "globex", companyName: "Globex International" },
      ],
    });
    await adapter.fetchJobs();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/boards/acme/jobs");
    expect(fetchSpy.mock.calls[1]?.[0]).toContain("/boards/globex/jobs");
  });
});
