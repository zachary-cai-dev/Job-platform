import { COUNTRY_BY_CODE } from "./data/countries.js";
import type { RegionCode } from "./types.js";

function lookup(code: string) {
  return COUNTRY_BY_CODE.get(code.toUpperCase());
}

export function isEuropeanCountry(code: string): boolean {
  return lookup(code)?.isEurope ?? false;
}

export function isEUCountry(code: string): boolean {
  return lookup(code)?.isEU ?? false;
}

export function isEEACountry(code: string): boolean {
  return lookup(code)?.isEEA ?? false;
}

export function isEMEACountry(code: string): boolean {
  return lookup(code)?.isEMEA ?? false;
}

/**
 * All regions a country is a member of, most specific first. Does not include
 * WORLDWIDE — that is a property of a job posting, never of a country.
 */
export function getRegionsForCountry(code: string): RegionCode[] {
  const info = lookup(code);
  if (!info) return [];
  const regions: RegionCode[] = [];
  if (info.isEU) regions.push("EU");
  if (info.isEEA) regions.push("EEA");
  if (info.isEurope) regions.push("EUROPE");
  if (info.isEMEA) regions.push("EMEA");
  return regions;
}

export function getCountryName(code: string): string | undefined {
  return lookup(code)?.name;
}
