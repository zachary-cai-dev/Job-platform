import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRemoteOkAdapter } from "../src/remoteok/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/remoteok-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("remoteok adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips the leading legal-notice entry", async () => {
    const adapter = createRemoteOkAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(2);
  });

  it("maps RemoteOK jobs to the common RawJobPayload shape", async () => {
    const adapter = createRemoteOkAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.externalId).toBe("1043215");
    expect(first?.rawTitle).toBe("Senior DevOps Engineer");
    expect(first?.rawLocation).toBe("Europe");
    expect(first?.companyName).toBe("Acme");
    expect(first?.applyUrl).toBe(first?.sourceUrl);
    expect(first?.postedAt).toEqual(new Date("2026-09-13T10:00:00+00:00"));
  });
});
