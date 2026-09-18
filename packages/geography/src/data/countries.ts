import type { CountryRegionInfo } from "../types.js";

/**
 * ISO 3166-1 alpha-2 country data with region membership flags.
 *
 * Region rules (see docs/geography.md):
 *  - EU member states are EU + EEA + EMEA + Europe.
 *  - EEA-only (Iceland, Liechtenstein, Norway) are EEA + EMEA + Europe, not EU.
 *  - Europe-only (UK, Switzerland, Balkans, etc.) are EMEA + Europe, not EU/EEA.
 *  - EMEA-only (Middle East, Africa) are EMEA, not Europe/EU/EEA.
 *  - Everything else is none of the above (used for negative-match parsing, e.g. "US only").
 *
 * This list is not the full ISO-3166 register (~249 entries) — it covers all of Europe,
 * a broad Middle East + Africa set (for EMEA correctness), and the non-European countries
 * most commonly named in remote job postings. Extend by adding rows; nothing else changes.
 */

function country(
  code: string,
  name: string,
  aliases: string[],
  flags: { isEurope: boolean; isEU: boolean; isEEA: boolean; isEMEA: boolean },
): CountryRegionInfo {
  return { code, name, aliases, ...flags };
}

const EU = { isEurope: true, isEU: true, isEEA: true, isEMEA: true };
const EEA_ONLY = { isEurope: true, isEU: false, isEEA: true, isEMEA: true };
const EUROPE_ONLY = { isEurope: true, isEU: false, isEEA: false, isEMEA: true };
const EMEA_ONLY = { isEurope: false, isEU: false, isEEA: false, isEMEA: true };
const NONE = { isEurope: false, isEU: false, isEEA: false, isEMEA: false };

export const COUNTRIES: CountryRegionInfo[] = [
  // --- EU member states (27) ---
  country("AT", "Austria", [], EU),
  country("BE", "Belgium", [], EU),
  country("BG", "Bulgaria", [], EU),
  country("HR", "Croatia", [], EU),
  country("CY", "Cyprus", [], EU),
  country("CZ", "Czechia", ["Czech Republic"], EU),
  country("DK", "Denmark", [], EU),
  country("EE", "Estonia", [], EU),
  country("FI", "Finland", [], EU),
  country("FR", "France", [], EU),
  country("DE", "Germany", [], EU),
  country("GR", "Greece", [], EU),
  country("HU", "Hungary", [], EU),
  country("IE", "Ireland", [], EU),
  country("IT", "Italy", [], EU),
  country("LV", "Latvia", [], EU),
  country("LT", "Lithuania", [], EU),
  country("LU", "Luxembourg", [], EU),
  country("MT", "Malta", [], EU),
  country("NL", "Netherlands", ["Holland"], EU),
  country("PL", "Poland", [], EU),
  country("PT", "Portugal", [], EU),
  country("RO", "Romania", [], EU),
  country("SK", "Slovakia", [], EU),
  country("SI", "Slovenia", [], EU),
  country("ES", "Spain", [], EU),
  country("SE", "Sweden", [], EU),

  // --- EEA, non-EU (3) ---
  country("IS", "Iceland", [], EEA_ONLY),
  country("LI", "Liechtenstein", [], EEA_ONLY),
  country("NO", "Norway", [], EEA_ONLY),

  // --- Europe, non-EU/non-EEA ---
  country("GB", "United Kingdom", [
    "UK",
    "U.K.",
    "Great Britain",
    "England",
    "Scotland",
    "Wales",
    "Northern Ireland",
  ], EUROPE_ONLY),
  country("CH", "Switzerland", [], EUROPE_ONLY),
  country("AL", "Albania", [], EUROPE_ONLY),
  country("AD", "Andorra", [], EUROPE_ONLY),
  country("BY", "Belarus", [], EUROPE_ONLY),
  country("BA", "Bosnia and Herzegovina", [], EUROPE_ONLY),
  country("FO", "Faroe Islands", [], EUROPE_ONLY),
  country("GI", "Gibraltar", [], EUROPE_ONLY),
  country("GG", "Guernsey", [], EUROPE_ONLY),
  country("IM", "Isle of Man", [], EUROPE_ONLY),
  country("JE", "Jersey", [], EUROPE_ONLY),
  country("XK", "Kosovo", [], EUROPE_ONLY),
  country("MD", "Moldova", [], EUROPE_ONLY),
  country("MC", "Monaco", [], EUROPE_ONLY),
  country("ME", "Montenegro", [], EUROPE_ONLY),
  country("MK", "North Macedonia", [], EUROPE_ONLY),
  country("RU", "Russia", [], EUROPE_ONLY),
  country("SM", "San Marino", [], EUROPE_ONLY),
  country("RS", "Serbia", [], EUROPE_ONLY),
  country("UA", "Ukraine", [], EUROPE_ONLY),
  country("VA", "Vatican City", [], EUROPE_ONLY),

  // --- Transcontinental: flagged EMEA, not Europe by default (see docs/geography.md §2.3) ---
  country("TR", "Turkey", ["Türkiye"], EMEA_ONLY),
  country("GE", "Georgia", [], EMEA_ONLY),
  country("AM", "Armenia", [], EMEA_ONLY),
  country("AZ", "Azerbaijan", [], EMEA_ONLY),

  // --- Middle East (EMEA-only) ---
  country("AE", "United Arab Emirates", ["UAE"], EMEA_ONLY),
  country("SA", "Saudi Arabia", [], EMEA_ONLY),
  country("IL", "Israel", [], EMEA_ONLY),
  country("QA", "Qatar", [], EMEA_ONLY),
  country("KW", "Kuwait", [], EMEA_ONLY),
  country("BH", "Bahrain", [], EMEA_ONLY),
  country("OM", "Oman", [], EMEA_ONLY),
  country("JO", "Jordan", [], EMEA_ONLY),
  country("LB", "Lebanon", [], EMEA_ONLY),
  country("IQ", "Iraq", [], EMEA_ONLY),
  country("IR", "Iran", [], EMEA_ONLY),
  country("YE", "Yemen", [], EMEA_ONLY),
  country("SY", "Syria", [], EMEA_ONLY),
  country("PS", "Palestine", [], EMEA_ONLY),

  // --- Africa (EMEA-only) ---
  country("EG", "Egypt", [], EMEA_ONLY),
  country("MA", "Morocco", [], EMEA_ONLY),
  country("DZ", "Algeria", [], EMEA_ONLY),
  country("TN", "Tunisia", [], EMEA_ONLY),
  country("LY", "Libya", [], EMEA_ONLY),
  country("NG", "Nigeria", [], EMEA_ONLY),
  country("KE", "Kenya", [], EMEA_ONLY),
  country("ZA", "South Africa", [], EMEA_ONLY),
  country("GH", "Ghana", [], EMEA_ONLY),
  country("ET", "Ethiopia", [], EMEA_ONLY),
  country("TZ", "Tanzania", [], EMEA_ONLY),
  country("UG", "Uganda", [], EMEA_ONLY),
  country("RW", "Rwanda", [], EMEA_ONLY),
  country("SN", "Senegal", [], EMEA_ONLY),
  country("CI", "Ivory Coast", ["Côte d'Ivoire"], EMEA_ONLY),
  country("CM", "Cameroon", [], EMEA_ONLY),
  country("ZM", "Zambia", [], EMEA_ONLY),
  country("ZW", "Zimbabwe", [], EMEA_ONLY),
  country("MZ", "Mozambique", [], EMEA_ONLY),
  country("AO", "Angola", [], EMEA_ONLY),
  country("BW", "Botswana", [], EMEA_ONLY),
  country("NA", "Namibia", [], EMEA_ONLY),
  country("MU", "Mauritius", [], EMEA_ONLY),
  country("SD", "Sudan", [], EMEA_ONLY),
  country("ML", "Mali", [], EMEA_ONLY),
  country("GA", "Gabon", [], EMEA_ONLY),
  country("CD", "DR Congo", ["Democratic Republic of the Congo"], EMEA_ONLY),

  // --- Rest of world (not EMEA, not Europe) — needed to correctly parse/exclude
  // job posts naming these countries, e.g. "US only", "Remote US, Canada" ---
  country("US", "United States", ["USA", "U.S.", "United States of America"], NONE),
  country("CA", "Canada", [], NONE),
  country("MX", "Mexico", [], NONE),
  country("BR", "Brazil", [], NONE),
  country("AR", "Argentina", [], NONE),
  country("CL", "Chile", [], NONE),
  country("CO", "Colombia", [], NONE),
  country("PE", "Peru", [], NONE),
  country("AU", "Australia", [], NONE),
  country("NZ", "New Zealand", [], NONE),
  country("IN", "India", [], NONE),
  country("PK", "Pakistan", [], NONE),
  country("BD", "Bangladesh", [], NONE),
  country("LK", "Sri Lanka", [], NONE),
  country("SG", "Singapore", [], NONE),
  country("MY", "Malaysia", [], NONE),
  country("TH", "Thailand", [], NONE),
  country("VN", "Vietnam", [], NONE),
  country("PH", "Philippines", [], NONE),
  country("ID", "Indonesia", [], NONE),
  country("JP", "Japan", [], NONE),
  country("KR", "South Korea", [], NONE),
  country("CN", "China", [], NONE),
  country("HK", "Hong Kong", [], NONE),
  country("TW", "Taiwan", [], NONE),
];

export const COUNTRY_BY_CODE: ReadonlyMap<string, CountryRegionInfo> = new Map(
  COUNTRIES.map((c) => [c.code, c]),
);

/**
 * Reverse lookup: lowercased name/alias -> country code. Built once at module load.
 * Longer phrases are preferred over shorter ones by consumers ordering matches by
 * phrase length (see normalizeLocation.ts) so e.g. "Czech Republic" wins over any
 * partial overlap.
 */
export const COUNTRY_NAME_INDEX: ReadonlyMap<string, string> = new Map(
  COUNTRIES.flatMap((c) => [
    [c.name.toLowerCase(), c.code] as const,
    ...c.aliases.map((a) => [a.toLowerCase(), c.code] as const),
  ]),
);
