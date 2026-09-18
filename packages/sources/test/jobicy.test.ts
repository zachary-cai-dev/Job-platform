import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJobicyAdapter } from "../src/jobicy/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/jobicy-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("jobicy adapter", () => {
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
    const adapter = createJobicyAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.externalId).toBe("153312");
    expect(first?.rawTitle).toBe("Engineering Manager - EU");
    expect(first?.rawLocation).toBe("Europe");
    expect(first?.companyName).toBe("Toptal");
    expect(first?.sourceUrl).toBe(first?.applyUrl);
    expect(first?.description).toContain("Employment type: Full-Time");
    expect(first?.postedAt).toEqual(new Date("2026-09-15T06:00:00+00:00"));
  });

  it("passes geo and industry filters through as query params", async () => {
    const adapter = createJobicyAdapter({ geo: "europe", industry: "dev" });
    await adapter.fetchJobs();
    const [requestedUrl] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(requestedUrl).toContain("geo=europe");
    expect(requestedUrl).toContain("industry=dev");
  });
});
