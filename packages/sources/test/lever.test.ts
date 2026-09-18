import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLeverAdapter } from "../src/lever/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/lever-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("lever adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Lever postings to the common RawJobPayload shape", async () => {
    const adapter = createLeverAdapter({
      companies: [{ companySlug: "acme", companyName: "Acme Corp" }],
    });
    const result = await adapter.fetchJobs();

    expect(result.jobs).toHaveLength(2);
    const [first] = result.jobs;
    expect(first?.externalId).toBe("a1b2c3d4-0000-1111-2222-333344445555");
    expect(first?.rawTitle).toBe("Senior Full Stack Engineer");
    expect(first?.applyUrl).toBe("https://jobs.lever.co/acme/a1b2c3d4/apply");
    expect(first?.rawLocation).toBe("Remote - UK and Ireland");
    expect(first?.companyName).toBe("Acme Corp");
    expect(first?.postedAt).toEqual(new Date(1757500800000));
  });

  it("falls back to hostedUrl when applyUrl is absent", async () => {
    const adapter = createLeverAdapter({
      companies: [{ companySlug: "acme", companyName: "Acme Corp" }],
    });
    const result = await adapter.fetchJobs();
    const [, second] = result.jobs;
    expect(second?.applyUrl).toBe("https://jobs.lever.co/acme/b2c3d4e5");
  });
});
