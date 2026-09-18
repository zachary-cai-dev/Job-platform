export type RegionCode = "EUROPE" | "EU" | "EEA" | "EMEA" | "WORLDWIDE";

export type GeographyConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface CountryRegionInfo {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string;
  name: string;
  aliases: string[];
  isEurope: boolean;
  isEU: boolean;
  isEEA: boolean;
  isEMEA: boolean;
}

export type LocationField = "title" | "locationRaw" | "description" | "structured";

export type LocationSignalKind =
  | "region"
  | "country"
  | "us-eligible"
  | "worldwide"
  | "exclusive-non-european"
  | "timezone"
  | "weak-company";

export interface LocationSignal {
  /** The exact substring that matched. */
  phrase: string;
  field: LocationField;
  kind: LocationSignalKind;
  /** RegionCode for "region"/"worldwide", ISO country code for "country"/"us-eligible", null otherwise. */
  value: RegionCode | string | null;
}

export interface NormalizedLocation {
  regions: RegionCode[];
  countries: string[];
  isWorldwide: boolean;
  /** "only" / "must be based in" / "exclusively" language detected alongside a list. */
  isExclusiveList: boolean;
  signals: LocationSignal[];
}

export interface EligibilityInput {
  locationRaw?: string;
  title?: string;
  descriptionText?: string;
  /** Discrete office/location metadata as provided by the source (most trustworthy). */
  structuredLocations?: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  eligibleRegions: RegionCode[];
  eligibleCountries: string[];
  confidence: GeographyConfidence;
  reason: string;
  signals: LocationSignal[];
}
