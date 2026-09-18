import { describe, expect, it } from "vitest";
import { evaluateEuropeanEligibility } from "../src/evaluateEuropeanEligibility.js";
import type { EligibilityResult } from "../src/types.js";

function evalRaw(locationRaw: string): EligibilityResult {
  return evaluateEuropeanEligibility({ locationRaw });
}

describe("evaluateEuropeanEligibility — INCLUDE, HIGH confidence", () => {
  const includeHighCases: string[] = [
    "Remote Europe",
    "Remote EU",
    "Remote EEA",
    "Remote EMEA",
    "Remote Germany",
    "Remote UK",
    "Remote US",
    "US only",
    "Remote North America",
    "North America only",
    "Remote Germany, Spain and France",
    "Remote US, Canada, UK and Germany",
    "Remote worldwide",
    "Remote anywhere",
    "Candidates must be located in the EU",
    "Remote within Europe",
    "Remote UK / Germany / France",
    "Remote - Germany, France, Netherlands",
    "Remote - UK and Ireland",
    "Spain, Portugal, Germany or Poland",
  ];

  it.each(includeHighCases)('"%s" → eligible, HIGH', (input) => {
    const result = evalRaw(input);
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe("HIGH");
  });

  it('"Remote US, Canada, UK and Germany" includes supported European and US countries', () => {
    const result = evalRaw("Remote US, Canada, UK and Germany");
    expect([...result.eligibleCountries].sort()).toEqual(["DE", "GB", "US"]);
    expect(result.eligibleCountries).not.toContain("CA");
  });

  it('"Remote Germany, Spain and France" includes exactly DE, ES, FR', () => {
    const result = evalRaw("Remote Germany, Spain and France");
    expect([...result.eligibleCountries].sort()).toEqual(["DE", "ES", "FR"]);
  });

  it('"Remote EU" resolves the EU region', () => {
    const result = evalRaw("Remote EU");
    expect(result.eligibleRegions).toContain("EU");
  });

  it('"Remote worldwide" resolves WORLDWIDE with no specific countries', () => {
    const result = evalRaw("Remote worldwide");
    expect(result.eligibleRegions).toEqual(["WORLDWIDE"]);
    expect(result.eligibleCountries).toEqual([]);
  });
});

describe("evaluateEuropeanEligibility — EXCLUDE, HIGH confidence", () => {
  const excludeHighCases: string[] = [
    "Canada only",
    "LATAM only",
    "APAC only",
    "Australia only",
    "India only",
  ];

  it.each(excludeHighCases)('"%s" → not eligible, HIGH', (input) => {
    const result = evalRaw(input);
    expect(result.eligible).toBe(false);
    expect(result.confidence).toBe("HIGH");
  });
});

describe("evaluateEuropeanEligibility — LOW confidence, not published", () => {
  const lowCases: string[] = ["European team", "We have offices throughout Europe"];

  it.each(lowCases)('"%s" → not eligible, LOW (no corroboration)', (input) => {
    const result = evalRaw(input);
    expect(result.eligible).toBe(false);
    expect(result.confidence).toBe("LOW");
  });

  it("unparseable / empty location → not eligible, LOW", () => {
    const result = evaluateEuropeanEligibility({});
    expect(result.eligible).toBe(false);
    expect(result.confidence).toBe("LOW");
  });
});

describe("evaluateEuropeanEligibility — MEDIUM confidence, published", () => {
  it('"Timezone preference: CET" → eligible, MEDIUM', () => {
    const result = evalRaw("Timezone preference: CET");
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("GMT+1 timezone phrase → eligible, MEDIUM", () => {
    const result = evalRaw("Working hours overlap with GMT+1");
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe("MEDIUM");
  });
});

describe("evaluateEuropeanEligibility — multi-field corroboration", () => {
  it("weak locationRaw + HIGH region signal in description → overall HIGH, eligible", () => {
    const result = evaluateEuropeanEligibility({
      locationRaw: "European team",
      descriptionText: "This role is Remote EU, working closely with our Berlin office.",
    });
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe("HIGH");
  });

  it("structuredLocations alone can decide eligibility", () => {
    const result = evaluateEuropeanEligibility({
      structuredLocations: ["Germany"],
      locationRaw: "Remote",
    });
    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe("HIGH");
    expect(result.eligibleCountries).toEqual(["DE"]);
  });

  it("a country-shaped word appearing only in free-text description does not decide eligibility", () => {
    // "Jordan" is a country name but also a common first name; it must not cause a
    // false EXCLUDE when it's clearly not a location statement and no other signal exists.
    const result = evaluateEuropeanEligibility({
      descriptionText: "Our hiring manager Jordan will reach out to shortlisted candidates.",
    });
    expect(result.eligible).toBe(false);
    expect(result.confidence).toBe("LOW");
    expect(result.reason).toBe("No parseable location signal");
  });

  it("title country mention is decisive like locationRaw", () => {
    const result = evaluateEuropeanEligibility({ title: "Senior Backend Engineer (Remote - Poland)" });
    expect(result.eligible).toBe(true);
    expect(result.eligibleCountries).toEqual(["PL"]);
  });

  it("a 'North America only' restriction stated only in the description still includes US", () => {
    // Regression: US_ELIGIBILITY_PHRASES and EXCLUSIVE_NON_EUROPEAN_REGION_PHRASES
    // both used to list "north america only", so a mention outside a decisive
    // field (title/locationRaw/structured) hit Rule 3 (exclusive-non-european)
    // before Rule 2 (country list) ever saw the US signal, and the job was
    // wrongly excluded.
    const result = evaluateEuropeanEligibility({
      title: "Senior Backend Engineer",
      descriptionText: "This role is North America only, fully remote.",
    });
    expect(result.eligible).toBe(true);
    expect(result.eligibleCountries).toEqual(["US"]);
  });
});

describe("evaluateEuropeanEligibility — case and punctuation variants", () => {
  it("is case-insensitive on region phrases", () => {
    expect(evalRaw("REMOTE EU").eligible).toBe(true);
    expect(evalRaw("remote eu").eligible).toBe(true);
    expect(evalRaw("Remote Eu").eligible).toBe(true);
  });

  it("is case-insensitive on broad US eligibility phrases", () => {
    expect(evalRaw("NORTH AMERICA ONLY").eligible).toBe(true);
    expect(evalRaw("North America Only").eligible).toBe(true);
  });

  it("only trusts short country codes as isolated uppercase tokens, not lowercase prose", () => {
    // lowercase "us" must not be read as the country code US (it's an ordinary word)
    const result = evalRaw("Join us — this role is Remote EU");
    expect(result.eligible).toBe(true);
    expect(result.eligibleCountries).not.toContain("US");
  });
});
