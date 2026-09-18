export type {
  RegionCode,
  GeographyConfidence,
  CountryRegionInfo,
  LocationField,
  LocationSignalKind,
  LocationSignal,
  NormalizedLocation,
  EligibilityInput,
  EligibilityResult,
} from "./types.js";

export {
  isEuropeanCountry,
  isEUCountry,
  isEEACountry,
  isEMEACountry,
  getRegionsForCountry,
  getCountryName,
} from "./countryQueries.js";

export { normalizeLocation } from "./normalizeLocation.js";
export { evaluateEuropeanEligibility } from "./evaluateEuropeanEligibility.js";
export { COUNTRIES, COUNTRY_BY_CODE, COUNTRY_NAME_INDEX } from "./data/countries.js";
