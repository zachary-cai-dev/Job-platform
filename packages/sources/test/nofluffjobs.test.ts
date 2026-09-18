import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNoFluffJobsAdapter } from "../src/nofluffjobs/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/nofluffjobs-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("nofluffjobs adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps postings and synthesizes a description from structured fields", async () => {
    const adapter = createNoFluffJobsAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.externalId).toBe(fixture.postings[0].id);
    expect(first?.sourceUrl).toBe(`https://nofluffjobs.com/job/${fixture.postings[0].url}`);
    expect(first?.applyUrl).toBe(first?.sourceUrl);
    expect(first?.rawTitle).toBe("Mobile Software Engineer 2 (Android)");
    expect(first?.rawLocation).toBe("Poznań, Poland");
    expect(first?.companyName).toBe("Grupa Allegro Sp. z o. o.");
    expect(first?.description).toContain("Primary technology: Android");
    expect(first?.description).toContain("Requirements: Android, Kotlin");
    expect(first?.postedAt).toEqual(new Date(1787323239954));
  });

  it("tolerates a place with no country (verified live — some postings have this)", async () => {
    const noCountryFixture = {
      postings: [
        {
          ...fixture.postings[0],
          location: { places: [{ city: "Somewhere" }], fullyRemote: false },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(noCountryFixture), { status: 200 })),
    );
    const adapter = createNoFluffJobsAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs[0]?.rawLocation).toBe("Somewhere");
  });

  it("describes fully-remote postings without a places array", async () => {
    const remoteFixture = {
      postings: [
        {
          ...fixture.postings[0],
          fullyRemote: true,
          location: { places: [], fullyRemote: true },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(remoteFixture), { status: 200 })),
    );
    const adapter = createNoFluffJobsAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs[0]?.rawLocation).toBe("Fully remote");
  });
});
