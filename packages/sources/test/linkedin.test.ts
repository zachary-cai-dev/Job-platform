import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLinkedInAdapter } from "../src/linkedin/adapter.js";
import {
  canonicalLinkedInJobUrl,
  detectLinkedInAccessRestriction,
  extractLinkedInJobId,
  parseLinkedInJobDetail,
  parseLinkedInSearchResults,
} from "../src/linkedin/parser.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf-8");
}

const searchHtml = fixture("linkedin-search-results.html");
const detailHtml = fixture("linkedin-job-detail.html");

afterEach(() => vi.unstubAllGlobals());

describe("LinkedIn parser", () => {
  it("extracts IDs from slugs, canonical paths, query strings, and entity URNs", () => {
    expect(extractLinkedInJobId("https://www.linkedin.com/jobs/view/backend-engineer-4012345678?trk=x")).toBe("4012345678");
    expect(extractLinkedInJobId("https://www.linkedin.com/jobs/view/4012345679")).toBe("4012345679");
    expect(extractLinkedInJobId("https://www.linkedin.com/jobs/search/?currentJobId=4012345680&amp;x=1")).toBe("4012345680");
    expect(extractLinkedInJobId("urn:li:jobPosting:4012345681")).toBe("4012345681");
  });

  it("extracts search cards and detects remote, hybrid, and on-site workplaces", () => {
    const jobs = parseLinkedInSearchResults(searchHtml, new Date("2026-09-17T00:00:00Z"));
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      externalId: "4012345678",
      title: "Senior Backend Engineer",
      company: "Example Ltd",
      location: "London, England, United Kingdom (Remote)",
      workplaceType: "remote",
      jobUrl: canonicalLinkedInJobUrl("4012345678"),
      postedAt: new Date("2026-09-15T00:00:00Z"),
    });
    expect(jobs.map((job) => job.workplaceType)).toEqual(["remote", "hybrid", "on-site"]);
  });

  it("prefers structured JobPosting data for detail fields and canonicalizes the URL", () => {
    const detail = parseLinkedInJobDetail(detailHtml);
    expect(detail).toMatchObject({
      externalId: "4012345678",
      title: "Senior Backend Engineer",
      company: "Example Ltd",
      companyUrl: "https://www.linkedin.com/company/example-ltd",
      location: "London, GB",
      workplaceType: "remote",
      employmentType: "full time",
      seniority: "Senior",
      jobUrl: "https://www.linkedin.com/jobs/view/4012345678",
      postedAt: new Date("2026-09-15T00:00:00.000Z"),
    });
    expect(detail?.description).toContain("Build resilient services");
  });

  it("keeps the requested search-card ID when page metadata contains a different identifier", () => {
    const fallback = parseLinkedInSearchResults(searchHtml)[0]!;
    const mismatched = detailHtml.replaceAll("4012345678", "9999999999");
    const detail = parseLinkedInJobDetail(mismatched, fallback);
    expect(detail?.externalId).toBe("4012345678");
    expect(detail?.jobUrl).toBe("https://www.linkedin.com/jobs/view/4012345678");
  });

  it("extracts structured salary and includes it for the existing normalizer", () => {
    const detail = parseLinkedInJobDetail(fixture("linkedin-salary-job.html"));
    expect(detail?.salary).toMatchObject({ min: 70000, max: 90000, currency: "GBP", unit: "year" });
    expect(detail?.description).toContain("Salary: GBP 70000 - 90000 per year");
  });

  it("allows a public job with no description and rejects malformed empty HTML", () => {
    expect(parseLinkedInJobDetail(fixture("linkedin-no-description.html"))?.description).toBe("");
    expect(parseLinkedInJobDetail(fixture("linkedin-malformed-job.html"))).toBeNull();
    expect(parseLinkedInJobDetail("")).toBeNull();
  });

  it("detects CAPTCHA, challenge, and login walls without treating normal sign-in links as blocked", () => {
    expect(detectLinkedInAccessRestriction('<div class="g-recaptcha"></div>')).toBe("captcha");
    expect(detectLinkedInAccessRestriction('<a href="/checkpoint/challenge">Verify</a>')).toBe("challenge");
    expect(detectLinkedInAccessRestriction('<main class="authwall">Join</main>')).toBe("login");
    expect(detectLinkedInAccessRestriction('<a href="/login">Sign in</a><main>Public jobs</main>')).toBeUndefined();
  });
});

describe("LinkedIn adapter", () => {
  it("searches public pages, fetches details sequentially, and maps the common payload", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/jobs/search/")) return new Response(searchHtml, { status: 200 });
      if (url.endsWith("4012345678")) return new Response(detailHtml, { status: 200 });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createLinkedInAdapter({
      keywords: ["Senior Backend Engineer"], locations: ["United Kingdom"], maxJobs: 3, maxPages: 1, requestDelayMs: 0,
    });
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      externalId: "4012345678",
      sourceUrl: "https://www.linkedin.com/jobs/view/4012345678",
      companyName: "Example Ltd",
      remoteType: "FULLY_REMOTE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not fetch detail pages for known IDs and reports them for last-seen persistence", async () => {
    const fetchMock = vi.fn(async () => new Response(searchHtml, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createLinkedInAdapter({
      keywords: ["Engineer"], locations: ["London"], maxJobs: 1, maxPages: 1, requestDelayMs: 0,
    });
    const result = await adapter.fetchJobs({
      knownExternalIds: new Set(["4012345678", "4012345679", "4012345680"]),
    });
    expect(result.jobs).toEqual([]);
    expect(result.seenKnownExternalIds).toEqual(["4012345678", "4012345679", "4012345680"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not let known IDs consume the new-detail cap or prevent later searches", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("location=London")) return new Response(searchHtml, { status: 200 });
      if (url.includes("location=Manchester")) {
        return new Response(searchHtml.replaceAll("4012345678", "4012345699"), { status: 200 });
      }
      return new Response(detailHtml, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createLinkedInAdapter({
      keywords: ["Engineer"], locations: ["London", "Manchester"], maxJobs: 1, maxPages: 1, requestDelayMs: 0,
      parserVersion: 2,
    });
    const result = await adapter.fetchJobs({
      knownExternalIds: new Set(["4012345678", "4012345679", "4012345680"]),
    });
    expect(result.jobs.map((job) => job.externalId)).toEqual(["4012345699"]);
    expect(result.jobs[0]?.rawPayload).toMatchObject({ parserVersion: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops gracefully on 429 without retrying or throwing", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createLinkedInAdapter({
      keywords: ["Engineer"], locations: ["London"], requestDelayMs: 0,
    });
    await expect(adapter.fetchJobs()).resolves.toEqual({ jobs: [], seenKnownExternalIds: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops pagination when a page produces no new IDs", async () => {
    const fetchMock = vi.fn(async () => new Response(searchHtml, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createLinkedInAdapter({
      keywords: ["Engineer"], locations: ["London"], maxJobs: 10, maxPages: 10, requestDelayMs: 0,
    });
    await adapter.fetchJobs({ knownExternalIds: new Set(["4012345678", "4012345679", "4012345680"]) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
