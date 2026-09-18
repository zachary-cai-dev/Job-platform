import { describe, expect, it } from "vitest";
import { extractSalary } from "../src/salaryExtraction.js";

describe("extractSalary", () => {
  it("parses a k-suffixed EUR range with no explicit period", () => {
    const result = extractSalary("€90k - €110k");
    expect(result).toEqual({
      salaryMin: 90000,
      salaryMax: 110000,
      salaryCurrency: "EUR",
      salaryPeriod: null,
    });
  });

  it("parses a comma-grouped USD range with an explicit yearly period", () => {
    const result = extractSalary("$120,000-$150,000/year");
    expect(result).toEqual({
      salaryMin: 120000,
      salaryMax: 150000,
      salaryCurrency: "USD",
      salaryPeriod: "YEARLY",
    });
  });

  it("parses a single GBP daily rate", () => {
    const result = extractSalary("£500/day");
    expect(result).toEqual({
      salaryMin: 500,
      salaryMax: 500,
      salaryCurrency: "GBP",
      salaryPeriod: "DAILY",
    });
  });

  it("parses a space-grouped PLN range with a monthly period", () => {
    const result = extractSalary("PLN 15 000 – 20 000 / mies.");
    expect(result).toEqual({
      salaryMin: 15000,
      salaryMax: 20000,
      salaryCurrency: "PLN",
      salaryPeriod: "MONTHLY",
    });
  });

  it("returns all-null for text with no salary information", () => {
    expect(extractSalary("We are a friendly, collaborative team")).toEqual({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });
  });

  it("returns all-null for blank input", () => {
    expect(extractSalary("")).toEqual({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });
    expect(extractSalary(undefined)).toEqual({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });
  });

  it("does not merge an adjacent unrelated number into the salary figure", () => {
    const result = extractSalary("$50,000 2024 hires wanted");
    expect(result.salaryMin).toBe(50000);
    expect(result.salaryMax).toBe(50000);
  });
});
