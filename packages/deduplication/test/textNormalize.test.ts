import { describe, expect, it } from "vitest";
import { normalizeApplyUrl, normalizeCompanyName } from "../src/textNormalize.js";

describe("normalizeCompanyName", () => {
  it("strips legal suffixes, case, and punctuation", () => {
    expect(normalizeCompanyName("Acme Corp")).toBe("acme");
    expect(normalizeCompanyName("Acme, Inc.")).toBe("acme");
    expect(normalizeCompanyName("Acme GmbH")).toBe("acme");
    expect(normalizeCompanyName("ACME LTD")).toBe("acme");
  });

  it("treats equivalent names as equal after normalization", () => {
    expect(normalizeCompanyName("Acme Corp")).toBe(normalizeCompanyName("Acme, Inc."));
  });
});

describe("normalizeApplyUrl", () => {
  it("strips protocol differences, www, trailing slash, and query params", () => {
    const a = normalizeApplyUrl("https://boards.greenhouse.io/acme/jobs/1?utm=x");
    const b = normalizeApplyUrl("https://www.boards.greenhouse.io/acme/jobs/1/?utm=y&ref=z");
    expect(a).toBe(b);
  });

  it("distinguishes genuinely different paths", () => {
    const a = normalizeApplyUrl("https://boards.greenhouse.io/acme/jobs/1");
    const b = normalizeApplyUrl("https://boards.greenhouse.io/acme/jobs/2");
    expect(a).not.toBe(b);
  });
});
