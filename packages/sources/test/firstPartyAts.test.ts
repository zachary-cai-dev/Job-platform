import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCareerPage } from "../src/careerpage/adapter.js";
import { parsePersonioFeed } from "../src/personio/adapter.js";
import { mapPinpointJob } from "../src/pinpoint/adapter.js";
import { parseRecruiteeFeed } from "../src/recruitee/adapter.js";
import { parseRssItems } from "../src/shared/rss.js";
import { createTeamtailorAdapter, mapTeamtailorItem } from "../src/teamtailor/adapter.js";
import { createWorkableAdapter, mapWorkableJob } from "../src/workable/adapter.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

afterEach(() => vi.unstubAllGlobals());

describe("first-party ATS parsers", () => {
  it("maps Workable's public account response fields", () => {
    const input = JSON.parse(fixture("workable-sample.json")).jobs[0];
    const job = mapWorkableJob(input, { subdomain: "acme", companyName: "Acme" });
    expect(job).toMatchObject({
      externalId: "ABC123", rawTitle: "Senior Backend Engineer", rawLocation: "London, United Kingdom",
      remoteType: "HYBRID", employmentType: "PERMANENT", salaryMin: 80000, salaryMax: 100000,
      salaryCurrency: "GBP", salaryPeriod: "YEARLY",
      sourceUrl: "https://apply.workable.com/acme/j/ABC123/",
    });
  });

  it("collapses repeated Workable location variants by external ID", async () => {
    const sample = JSON.parse(fixture("workable-sample.json"));
    sample.jobs.push({ ...sample.jobs[0], city: "Manchester" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 })));
    const result = await createWorkableAdapter({
      companies: [{ subdomain: "acme", companyName: "Acme" }], requestDelayMs: 0,
    }).fetchJobs();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.rawLocation).toContain("London");
    expect(result.jobs[0]?.rawLocation).toContain("Manchester");
    expect(result.jobs[0]?.rawPayload).toHaveLength(2);
  });

  it("maps Teamtailor RSS metadata", () => {
    const [item] = parseRssItems(fixture("teamtailor-sample.rss"));
    const job = item && mapTeamtailorItem(item, { feedUrl: "https://career.acme.test/jobs.rss", companyName: "Acme" });
    expect(job).toMatchObject({ externalId: "tt-1", rawTitle: "Senior React Engineer", remoteType: "HYBRID" });
    expect(job?.rawLocation).toContain("London");
    expect(job?.postedAt).toEqual(new Date("2026-09-15T10:00:00.000Z"));
  });

  it("paginates Teamtailor and stops at the exhausted page", async () => {
    const xml = fixture("teamtailor-sample.rss");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(xml, { status: 200 }))
      .mockResolvedValueOnce(new Response("<rss><channel></channel></rss>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createTeamtailorAdapter({
      companies: [{ feedUrl: "https://career.acme.test/jobs.rss", companyName: "Acme" }],
      pageSize: 1, maxPages: 5, requestDelayMs: 0,
    });
    expect((await adapter.fetchJobs()).jobs).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("offset=1");
  });

  it("parses Personio XML", () => {
    const [job] = parsePersonioFeed(fixture("personio-sample.xml"), { account: "acme", companyName: "Acme" });
    expect(job).toMatchObject({
      externalId: "p1", rawTitle: "Staff Software Engineer", remoteType: "HYBRID",
      employmentType: "PERMANENT", sourceUrl: "https://acme.jobs.personio.com/job/p1?language=en",
    });
    expect(job?.description).toContain("This hybrid role");
  });

  it("maps Pinpoint salary and workplace fields", () => {
    const input = JSON.parse(fixture("pinpoint-sample.json")).data[0];
    const job = mapPinpointJob(input, { subdomain: "acme", companyName: "Acme" });
    expect(job).toMatchObject({
      externalId: "pp1", remoteType: "FULLY_REMOTE", employmentType: "PERMANENT",
      salaryMin: 70000, salaryMax: 90000, salaryCurrency: "GBP", salaryPeriod: "YEARLY",
    });
  });

  it("parses Recruitee XML and its canonical employer URL", () => {
    const [job] = parseRecruiteeFeed(fixture("recruitee-sample.xml"), { subdomain: "acme", companyName: "Acme" });
    expect(job).toMatchObject({
      externalId: "rq1", rawTitle: "AI Engineer", remoteType: "FULLY_REMOTE",
      salaryMin: 90000, salaryMax: 120000, salaryCurrency: "EUR",
      sourceUrl: "https://acme.recruitee.com/o/ai-engineer",
    });
    expect(job?.description).toContain("Build AI systems");
  });

  it("parses JobPosting JSON-LD from configured company pages", () => {
    const [job] = parseCareerPage(fixture("careerpage-sample.html"), "https://careers.acme.test/jobs/backend-1", {
      companyName: "Acme",
    });
    expect(job).toMatchObject({
      externalId: "cp1", companyName: "Acme", rawLocation: "Europe", remoteType: "FULLY_REMOTE",
      employmentType: "PERMANENT", salaryMin: 80000, salaryMax: 100000, salaryCurrency: "EUR",
      sourceUrl: "https://careers.acme.test/jobs/backend-1",
    });
  });

  it("returns empty results for malformed or empty documents", () => {
    expect(parsePersonioFeed("<broken>", { account: "acme", companyName: "Acme" })).toEqual([]);
    expect(parseRecruiteeFeed("", { subdomain: "acme", companyName: "Acme" })).toEqual([]);
    expect(parseCareerPage("<script type='application/ld+json'>{bad}</script>", "https://acme.test/job", { companyName: "Acme" })).toEqual([]);
  });
});
