import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkingNomadsAdapter } from "../src/workingnomads/adapter.js";

const fixturePath = fileURLToPath(new URL("./fixtures/workingnomads-sample.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

describe("workingnomads adapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps every job in the flat array response, including non-tech ones", async () => {
    const adapter = createWorkingNomadsAdapter();
    const result = await adapter.fetchJobs();
    expect(result.jobs).toHaveLength(2);
  });

  it("maps fields and folds tags into the description", async () => {
    const adapter = createWorkingNomadsAdapter();
    const result = await adapter.fetchJobs();
    const [first] = result.jobs;
    expect(first?.externalId).toBe("https://www.workingnomads.com/job/go/1864402/");
    expect(first?.rawTitle).toBe("Senior Backend Engineer");
    expect(first?.rawLocation).toBe("Europe");
    expect(first?.companyName).toBe("Acme Remote");
    expect(first?.description).toContain("Tags: python,django,postgresql");
    expect(first?.postedAt).toEqual(new Date("2026-09-15T10:10:56-04:00"));
  });
});
