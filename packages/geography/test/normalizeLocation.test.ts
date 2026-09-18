import { describe, expect, it } from "vitest";
import { normalizeLocation } from "../src/normalizeLocation.js";

describe("normalizeLocation", () => {
  it("returns empty result for blank input", () => {
    expect(normalizeLocation(undefined)).toEqual({
      regions: [],
      countries: [],
      isWorldwide: false,
      isExclusiveList: false,
      signals: [],
    });
    expect(normalizeLocation("   ").regions).toEqual([]);
  });

  it("extracts multiple countries from a separator-delimited list", () => {
    const result = normalizeLocation("Remote - Germany, France, Netherlands");
    expect([...result.countries].sort()).toEqual(["DE", "FR", "NL"]);
  });

  it("extracts region keywords distinctly per region", () => {
    expect(normalizeLocation("Remote EU").regions).toEqual(["EU"]);
    expect(normalizeLocation("Remote EEA").regions).toEqual(["EEA"]);
    expect(normalizeLocation("Remote EMEA").regions).toEqual(["EMEA"]);
    expect(normalizeLocation("Remote Europe").regions).toEqual(["EUROPE"]);
  });

  it("detects exclusivity language", () => {
    expect(normalizeLocation("US only").isExclusiveList).toBe(true);
    expect(normalizeLocation("Remote Germany").isExclusiveList).toBe(false);
    expect(normalizeLocation("Candidates must be located in the EU").isExclusiveList).toBe(true);
  });

  it("detects worldwide phrases", () => {
    expect(normalizeLocation("Remote worldwide").isWorldwide).toBe(true);
    expect(normalizeLocation("Remote anywhere").isWorldwide).toBe(true);
    expect(normalizeLocation("Remote Germany").isWorldwide).toBe(false);
  });

  it("maps North America remote eligibility to US access", () => {
    expect(normalizeLocation("Remote North America").countries).toEqual(["US"]);
    expect(normalizeLocation("North America only").countries).toEqual(["US"]);
  });

  it("does not match a country name that is only a substring of another word", () => {
    // "Iceland" is a country (IS); make sure word-boundary matching doesn't fire
    // against "icelandic" or similar longer words that merely start with it.
    const result = normalizeLocation("The team culture is very icelandic in spirit");
    expect(result.countries).toEqual([]);
  });

  it("tags every signal with the field it came from", () => {
    const result = normalizeLocation("Remote EU", "title");
    expect(result.signals[0]?.field).toBe("title");
  });

  it("recognizes ISO country codes in dedicated location fields", () => {
    expect(normalizeLocation("London, GB").countries).toEqual(["GB"]);
    expect(normalizeLocation("Bengaluru, IN").countries).toEqual(["IN"]);
  });

  it("does not interpret ambiguous ISO-shaped tokens in titles as countries", () => {
    expect(normalizeLocation("Senior IT Engineer", "title").countries).toEqual([]);
    expect(normalizeLocation("Engineer IN Growth", "title").countries).toEqual([]);
  });
});
