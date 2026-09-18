import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWeWorkRemotelyAdapter } from "../src/weworkremotely/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/weworkremotely-sample.rss", import.meta.url));
const fixture = readFileSync(fixturePath, "utf-8");

describe("weworkremotely adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("polls one feed per configured category and splits 'Company: Title' into fields", async () => {
    const adapter = createWeWorkRemotelyAdapter({ categorySlugs: ["remote-programming-jobs"] });
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    const [first] = result.jobs;
    expect(first?.companyName).toBe("Acme Corp");
    expect(first?.rawTitle).toBe("Senior Backend Engineer");
    expect(first?.rawLocation).toBe("Anywhere in the World");
    expect(first?.sourceUrl).toBe("https://weworkremotely.com/remote-jobs/acme-senior-backend-engineer");
    expect(first?.applyUrl).toBe(first?.sourceUrl);
    expect(first?.description).toContain("<strong>Headquarters:</strong> Germany");
    expect(first?.postedAt).toEqual(new Date("Tue, 18 Aug 2026 20:34:15 +0000"));
  });

  it("fetches one job list per category slug, deduplicated only across slugs, not within", async () => {
    const fetchMock = vi.fn(async () => new Response(fixture, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createWeWorkRemotelyAdapter({ categorySlugs: ["remote-programming-jobs", "remote-devops-sysadmin-jobs"] });
    const result = await adapter.fetchJobs();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.jobs).toHaveLength(2);
  });
});
