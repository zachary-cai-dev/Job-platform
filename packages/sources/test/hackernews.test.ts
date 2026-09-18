import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHackerNewsAdapter } from "../src/hackernews/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/hackernews-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

function mockFetchImplementation(url: string): Response {
  if (url.includes("user/whoishiring.json")) {
    return new Response(JSON.stringify(fixture.user), { status: 200 });
  }
  const match = /item\/(\d+)\.json/.exec(url);
  const id = match?.[1];
  const item = id ? fixture.items[id] : undefined;
  return new Response(JSON.stringify(item ?? null), { status: 200 });
}

describe("hackernews adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => mockFetchImplementation(url)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds the 'Who is hiring?' thread, skipping the same-day 'Who wants to be hired?' one", async () => {
    const adapter = createHackerNewsAdapter();
    const result = await adapter.fetchJobs();
    // 5 kids total: 3 real postings, 1 deleted, 1 dead — only the 3 real ones survive.
    expect(result.jobs).toHaveLength(3);
  });

  it("splits the pipe-delimited header into a company name and leaves the rest as free text", async () => {
    const adapter = createHackerNewsAdapter();
    const result = await adapter.fetchJobs();
    const pango = result.jobs.find((j) => j.externalId === "49711313");
    expect(pango?.companyName).toBe("Pango");
    expect(pango?.rawTitle).toContain("Founding Software Engineer");
    expect(pango?.rawTitle).toContain("Stockholm, Sweden");
    expect(pango?.sourceUrl).toBe("https://news.ycombinator.com/item?id=49711313");
    expect(pango?.applyUrl).toBe(pango?.sourceUrl);
    expect(pango?.postedAt).toEqual(new Date(1789000000 * 1000));
  });

  it("filters out deleted and dead comments", async () => {
    const adapter = createHackerNewsAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs.some((j) => j.externalId === "49999001")).toBe(false);
    expect(result.jobs.some((j) => j.externalId === "49999002")).toBe(false);
  });

  it("strips HTML tags a poster embedded mid-header out of the parsed title", async () => {
    const adapter = createHackerNewsAdapter();
    const result = await adapter.fetchJobs();
    const quobyte = result.jobs.find((j) => j.externalId === "49523712");
    expect(quobyte?.rawTitle).not.toContain("<a");
    expect(quobyte?.rawTitle).toContain("https://www.quobyte.com/");
  });

  it("decodes HTML entities and strips a leading <a> link when a poster puts the company link first", async () => {
    const adapter = createHackerNewsAdapter();
    const result = await adapter.fetchJobs();
    const checkly = result.jobs.find((j) => j.externalId === "49537891");
    expect(checkly?.companyName).toBe("https://www.checklyhq.com");
    expect(checkly?.rawTitle).not.toContain("<a");
    expect(checkly?.rawTitle).not.toContain("&#x2F;");
    expect(checkly?.rawTitle).toContain("REMOTE (Europe / US Eastern)");
  });

  it("strips a trailing (YC ...) batch tag from the company name", async () => {
    const adapter = createHackerNewsAdapter();
    const result = await adapter.fetchJobs();
    const pango = result.jobs.find((j) => j.externalId === "49711313");
    expect(pango?.companyName).not.toContain("YC");
  });
});
