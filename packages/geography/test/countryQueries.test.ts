import { describe, expect, it } from "vitest";
import {
  isEuropeanCountry,
  isEUCountry,
  isEEACountry,
  isEMEACountry,
  getRegionsForCountry,
} from "../src/countryQueries.js";

describe("country region flags", () => {
  it("Germany: EUROPE, EU, EEA, EMEA", () => {
    expect(isEuropeanCountry("DE")).toBe(true);
    expect(isEUCountry("DE")).toBe(true);
    expect(isEEACountry("DE")).toBe(true);
    expect(isEMEACountry("DE")).toBe(true);
    expect(getRegionsForCountry("DE").sort()).toEqual(["EEA", "EMEA", "EU", "EUROPE"].sort());
  });

  it("France: EUROPE, EU, EEA, EMEA", () => {
    expect(isEuropeanCountry("FR")).toBe(true);
    expect(isEUCountry("FR")).toBe(true);
    expect(isEEACountry("FR")).toBe(true);
    expect(isEMEACountry("FR")).toBe(true);
  });

  it("Norway: EUROPE, EEA, EMEA, NOT EU", () => {
    expect(isEuropeanCountry("NO")).toBe(true);
    expect(isEUCountry("NO")).toBe(false);
    expect(isEEACountry("NO")).toBe(true);
    expect(isEMEACountry("NO")).toBe(true);
  });

  it("United Kingdom: EUROPE, EMEA, NOT EU, NOT EEA", () => {
    expect(isEuropeanCountry("GB")).toBe(true);
    expect(isEUCountry("GB")).toBe(false);
    expect(isEEACountry("GB")).toBe(false);
    expect(isEMEACountry("GB")).toBe(true);
  });

  it("Switzerland: EUROPE, EMEA, NOT EU, NOT EEA", () => {
    expect(isEuropeanCountry("CH")).toBe(true);
    expect(isEUCountry("CH")).toBe(false);
    expect(isEEACountry("CH")).toBe(false);
    expect(isEMEACountry("CH")).toBe(true);
  });

  it("United States: not European, not EMEA", () => {
    expect(isEuropeanCountry("US")).toBe(false);
    expect(isEUCountry("US")).toBe(false);
    expect(isEEACountry("US")).toBe(false);
    expect(isEMEACountry("US")).toBe(false);
  });

  it("UAE: EMEA but not Europe", () => {
    expect(isEuropeanCountry("AE")).toBe(false);
    expect(isEMEACountry("AE")).toBe(true);
  });

  it("is case-insensitive on country code casing", () => {
    expect(isEuropeanCountry("de")).toBe(true);
    expect(isEUCountry("fr")).toBe(true);
  });

  it("returns false/empty for unknown codes", () => {
    expect(isEuropeanCountry("ZZ")).toBe(false);
    expect(getRegionsForCountry("ZZ")).toEqual([]);
  });
});
