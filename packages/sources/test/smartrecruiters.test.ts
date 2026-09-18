import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSmartRecruitersAdapter } from "../src/smartrecruiters/adapter.js";

const listFixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/smartrecruiters-list-sample.json", import.meta.url)), "utf-8"),
);
const detailFixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/smartrecruiters-detail-sample.json", import.meta.url)), "utf-8"),
);

const secondDetailFixture = {
  id: "744000137768410",
  name: "Account Executive, APAC",
  location: { city: "Singapore", country: "sg", remote: false, fullLocation: "Singapore" },
  releasedDate: "2026-09-09T09:00:00.000Z",
  postingUrl: "https://jobs.smartrecruiters.com/Cint/744000137768410-account-executive-apac",
  applyUrl: "https://jobs.smartrecruiters.com/Cint/744000137768410-account-executive-apac?oga=true",
  jobAd: { sections: { jobDescription: { title: "Job Description", text: "<p>Drive APAC sales.</p>" } } },
};

describe("smartrecruiters adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/postings/744000137768409")) {
          return new Response(JSON.stringify(detailFixture), { status: 200 });
        }
        if (url.includes("/postings/744000137768410")) {
          return new Response(JSON.stringify(secondDetailFixture), { status: 200 });
        }
        if (url.includes("/postings?")) {
          return new Response(JSON.stringify(listFixture), { status: 200 });
        }
        throw new Error(`Unexpected URL in test: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the posting list, then resolves full detail (including description) per posting", async () => {
    const adapter = createSmartRecruitersAdapter({
      companies: [{ companyIdentifier: "Cint", companyName: "Cint" }],
    });
    const result = await adapter.fetchJobs();

    expect(result.jobs).toHaveLength(2);

    const [first, second] = result.jobs;
    expect(first?.externalId).toBe("744000137768409");
    expect(first?.rawTitle).toBe("Staff Software Engineer - DSM");
    expect(first?.rawLocation).toBe("Remote, United Kingdom");
    expect(first?.companyName).toBe("Cint");
    expect(first?.applyUrl).toContain("oga=true");
    expect(first?.description).toContain("Kubernetes");
    expect(first?.postedAt).toEqual(new Date("2026-09-10T09:00:00.000Z"));

    expect(second?.externalId).toBe("744000137768410");
    expect(second?.description).toContain("APAC sales");
  });

  it("paginates the list endpoint using offset/limit until totalFound is reached", async () => {
    const page1 = { offset: 0, limit: 1, totalFound: 2, content: [listFixture.content[0]] };
    const page2 = { offset: 1, limit: 1, totalFound: 2, content: [listFixture.content[1]] };
    let listCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/postings?")) {
          listCalls += 1;
          return new Response(JSON.stringify(listCalls === 1 ? page1 : page2), { status: 200 });
        }
        if (url.includes("744000137768409")) return new Response(JSON.stringify(detailFixture), { status: 200 });
        return new Response(JSON.stringify(secondDetailFixture), { status: 200 });
      }),
    );

    const adapter = createSmartRecruitersAdapter({
      companies: [{ companyIdentifier: "Cint", companyName: "Cint" }],
    });
    const result = await adapter.fetchJobs();

    expect(listCalls).toBe(2);
    expect(result.jobs).toHaveLength(2);
  });
});
