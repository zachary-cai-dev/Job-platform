import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPythonJobsAdapter } from "../src/pythonjobs/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/pythonjobs-sample.rss", import.meta.url));
const fixture = readFileSync(fixturePath, "utf-8");

describe("pythonjobs adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixture, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("splits 'Title, Company' titles and recovers the leading location line from the description", async () => {
    const adapter = createPythonJobsAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.rawTitle).toBe("Agentic Python Engineer");
    expect(first?.companyName).toBe("Evaboot");
    expect(first?.rawLocation).toBe("Remote, Remote/Worldwide, Remote/Worldwide, Remote");
    expect(first?.description).toContain("<p>Evaboot turns Sales Navigator");
    expect(first?.description).not.toContain("Remote/Worldwide, Remote/Worldwide");
  });

  it("leaves postedAt undefined since the feed never provides a per-item date", async () => {
    const adapter = createPythonJobsAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs[0]?.postedAt).toBeUndefined();
  });
});
