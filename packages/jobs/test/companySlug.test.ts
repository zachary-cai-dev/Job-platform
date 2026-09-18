import { describe, expect, it } from "vitest";
import { slugifyCompanyName } from "../src/companySlug.js";

describe("slugifyCompanyName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyCompanyName("Acme Corp")).toBe("acme-corp");
  });

  it("strips diacritics", () => {
    expect(slugifyCompanyName("Café Corp")).toBe("cafe-corp");
  });

  it("collapses punctuation and trims leading/trailing hyphens", () => {
    expect(slugifyCompanyName("Acme, Inc.")).toBe("acme-inc");
    expect(slugifyCompanyName("  Acme!!  ")).toBe("acme");
  });
});
