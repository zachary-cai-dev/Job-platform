import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWellfoundAdapter,
  extractWellfoundJobUrls,
  mapWellfoundJob,
  parseWellfoundJobPosting,
} from "../src/wellfound/adapter.js";

const fixture = (name: string) => readFileSync(
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
  "utf8",
);
const listingHtml = fixture("wellfound-listing.html");
const jobHtml = fixture("wellfound-job.html");
const malformedHtml = fixture("wellfound-malformed.html");

describe("wellfound adapter", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("extracts unique canonical Wellfound job URLs only", () => {
    expect(extractWellfoundJobUrls(listingHtml)).toEqual([
      "https://wellfound.com/jobs/4697947-senior-software-engineer",
      "https://wellfound.com/jobs/4697948-staff-backend-engineer",
    ]);
  });

  it("parses and maps structured JobPosting fields", () => {
    const posting = parseWellfoundJobPosting(jobHtml);
    expect(posting).not.toBeNull();
    expect(mapWellfoundJob("https://wellfound.com/jobs/4697947-senior-software-engineer", posting!)).toMatchObject({
      externalId: "4697947",
      rawTitle: "Senior Software Engineer",
      companyName: "Example Labs",
      companyUrl: "https://example.test",
      rawLocation: "United Kingdom, Germany",
      remoteType: "FULLY_REMOTE",
      employmentType: "PERMANENT",
      salaryMin: 90000,
      salaryMax: 120000,
      salaryCurrency: "GBP",
      salaryPeriod: "YEARLY",
      postedAt: new Date("2026-09-17T10:00:00Z"),
    });
  });

  it("rejects empty and malformed detail HTML", () => {
    expect(parseWellfoundJobPosting("")).toBeNull();
    const posting = parseWellfoundJobPosting(malformedHtml);
    expect(posting).not.toBeNull();
    expect(mapWellfoundJob("https://wellfound.com/jobs/1-malformed", posting!)).toBeNull();
  });

  it("skips known details without letting them consume the new-job cap", async () => {
    const secondPage = listingHtml.replaceAll("4697947", "4697997").replaceAll("4697948", "4697998");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("page=2")) return new Response(secondPage, { status: 200 });
      if (url.includes("/role/")) return new Response(listingHtml, { status: 200 });
      return new Response(jobHtml.replaceAll("4697947", "4697997"), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createWellfoundAdapter({ maxJobs: 1, maxPages: 2, requestDelayMs: 0 });
    const result = await adapter.fetchJobs({ knownExternalIds: new Set(["4697947", "4697948"]) });
    expect(result.seenKnownExternalIds).toEqual(["4697947", "4697948"]);
    expect(result.jobs.map(({ externalId }) => externalId)).toEqual(["4697997"]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("jobs/4697947"))).toBe(false);
  });

  it("stops gracefully when public access is restricted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    const adapter = createWellfoundAdapter({ requestDelayMs: 0 });
    await expect(adapter.fetchJobs()).resolves.toEqual({ jobs: [], seenKnownExternalIds: [] });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("access stopped"));
  });

  it("stores the configured parser version for one-time reprocessing", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      new Response(url.includes("/role/") ? listingHtml : jobHtml, { status: 200 }),
    ));
    const adapter = createWellfoundAdapter({ maxJobs: 1, maxPages: 1, requestDelayMs: 0, parserVersion: 2 });
    const result = await adapter.fetchJobs();
    expect(result.jobs[0]?.rawPayload).toMatchObject({ parserVersion: 2 });
  });
});
