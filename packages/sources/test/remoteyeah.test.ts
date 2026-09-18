import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRemoteYeahAdapter } from "../src/remoteyeah/adapter.js";

const categoryHtml = readFileSync(
  fileURLToPath(new URL("./fixtures/remoteyeah-category.html", import.meta.url)),
  "utf-8",
);
const jobHtml = readFileSync(fileURLToPath(new URL("./fixtures/remoteyeah-job.html", import.meta.url)), "utf-8");
const noJsonLdHtml = readFileSync(
  fileURLToPath(new URL("./fixtures/remoteyeah-job-no-jsonld.html", import.meta.url)),
  "utf-8",
);

function mockFetchImplementation(url: string): Response {
  if (url.includes("/remote-python-jobs")) return new Response(categoryHtml, { status: 200 });
  if (url.includes("remote-senior-python-engineer-acme")) return new Response(jobHtml, { status: 200 });
  if (url.includes("remote-backend-developer-widgetco")) return new Response(null, { status: 403 });
  if (url.includes("gitlab.com")) return new Response(null, { status: 403 });
  return new Response(noJsonLdHtml, { status: 200 });
}

describe("remoteyeah adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => mockFetchImplementation(url)),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("discovers job URLs from a category page and maps the ones with JobPosting JSON-LD", async () => {
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0 });
    const result = await adapter.fetchJobs();
    // 3 real remoteyeah.com job links on the category page (the /remote-companies
    // link isn't a job link, and the GitLab handbook link is off-site — see the
    // dedicated test below); "widgetco" 403s and "foobar" has no JobPosting
    // JSON-LD, so only "acme" survives.
    expect(result.jobs).toHaveLength(1);
  });

  it("does not treat an off-site link containing '/jobs/' as one of its own job postings", async () => {
    const fetchMock = vi.fn(async (url: string) => mockFetchImplementation(url));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0 });
    await adapter.fetchJobs();
    const requestedUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(requestedUrls.some((url) => url.includes("gitlab.com"))).toBe(false);
  });

  it("continues to the rest of the batch when one job page fetch fails", async () => {
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0 });
    const result = await adapter.fetchJobs();
    // "widgetco" 403s (simulating the real failure this regression test is for) —
    // the run must still complete and return the jobs that did succeed, not throw.
    expect(result.jobs.some((job) => job.rawTitle === "Senior Python Engineer")).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("failed to fetch job page"));
  });

  it("maps JobPosting fields to the common RawJobPayload shape", async () => {
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0, parserVersion: 2 });
    const result = await adapter.fetchJobs();
    const [job] = result.jobs;
    expect(job?.rawTitle).toBe("Senior Python Engineer");
    expect(job?.companyName).toBe("Acme Inc.");
    expect(job?.rawLocation).toBe("Germany, France");
    expect(job?.sourceUrl).toBe(job?.applyUrl);
    expect(job?.description).toContain("Employment type: FULL_TIME");
    expect(job?.description).toContain("Salary: EUR 70000–90000 / YEAR");
    expect(job?.description).toContain("Skills: Python, Django, PostgreSQL");
    expect(job?.postedAt).toEqual(new Date("2026-09-16T12:00:00+00:00"));
    expect(job?.rawPayload).toMatchObject({ parserVersion: 2 });
  });

  it("resolves relative job URLs against the site origin", async () => {
    const fetchMock = vi.fn(async (url: string) => mockFetchImplementation(url));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0 });
    await adapter.fetchJobs();
    const requestedUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(requestedUrls).toContain("https://remoteyeah.com/jobs/remote-data-engineer-foobar");
  });

  it("logs a warning and skips a job page with no JobPosting JSON-LD, without failing the whole run", async () => {
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0 });
    const result = await adapter.fetchJobs();
    expect(result.jobs.every((job) => job.rawTitle === "Senior Python Engineer")).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it("respects maxJobs as a cap on how many job pages get fetched", async () => {
    const fetchMock = vi.fn(async (url: string) => mockFetchImplementation(url));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], maxJobs: 1, requestDelayMs: 0 });
    await adapter.fetchJobs();
    const jobPageFetches = fetchMock.mock.calls.filter((call) => (call[0] as string).includes("/jobs/"));
    expect(jobPageFetches).toHaveLength(1);
  });

  it("skips known detail pages while reporting them for last-seen persistence", async () => {
    const knownUrl = "https://remoteyeah.com/jobs/remote-senior-python-engineer-acme";
    const fetchMock = vi.fn(async (url: string) => mockFetchImplementation(url));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createRemoteYeahAdapter({ categorySlugs: ["remote-python-jobs"], requestDelayMs: 0 });
    const result = await adapter.fetchJobs({ knownExternalIds: new Set([knownUrl]) });
    expect(result.seenKnownExternalIds).toContain(knownUrl);
    expect(fetchMock.mock.calls.some((call) => call[0] === knownUrl)).toBe(false);
  });
});
