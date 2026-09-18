import type { RegionCode } from "../types.js";

/**
 * All phrase dictionaries are plain data — adding a new phrasing is a data change,
 * not a code change. Matching is case-insensitive substring search over the raw text
 * (see normalizeLocation.ts); phrases are written lowercase here.
 */

export const REGION_PHRASES: Record<Exclude<RegionCode, "WORLDWIDE">, string[]> = {
  EUROPE: [
    "remote europe",
    "europe remote",
    "remote - europe",
    "remote-europe",
    "anywhere in europe",
    "work from anywhere in europe",
    "european candidates",
    "candidates based in europe",
    "remote within europe",
    "based in europe",
    "located in europe",
    "europe based",
    "european-based candidates",
  ],
  EU: [
    "remote eu",
    "eu remote",
    "remote - eu",
    "remote within the eu",
    "european union",
    "european union only",
    "eu residents",
    "eu-based candidates",
    "eu based candidates",
    "must be located in the eu",
    "located in the eu",
    "eu candidates",
  ],
  EEA: [
    "remote eea",
    "eea remote",
    "remote - eea",
    "european economic area",
    "candidates located within the eea",
    "eea residents",
    "eea-based candidates",
    "eea based candidates",
    "eea candidates",
  ],
  EMEA: [
    "remote emea",
    "emea remote",
    "remote - emea",
    "candidates based in emea",
    "emea region",
    "emea candidates",
    "emea-based candidates",
  ],
};

export const WORLDWIDE_PHRASES: string[] = [
  "worldwide",
  "remote worldwide",
  "remote - worldwide",
  "global remote",
  "remote - global",
  "remote globally",
  "remote anywhere",
  "work from anywhere",
  "location independent",
  "anywhere in the world",
];

/** Broad location phrases that necessarily include United States applicants. */
export const US_ELIGIBILITY_PHRASES: string[] = [
  "remote north america",
  "north america remote",
  "north america only",
  "anywhere in north america",
];

/**
 * Region-level (not single-country) phrases that explicitly restrict eligibility to
 * outside Europe. Requires an explicit exclusivity qualifier ("only" etc.) because,
 * unlike a named country, a bare region word ("APAC") isn't on its own a statement
 * that Europe is excluded.
 *
 * "north america only" (and its variants) deliberately excluded here — it's claimed
 * by US_ELIGIBILITY_PHRASES above instead. Keeping it in both dictionaries meant
 * `normalizeLocation` emitted a "country: US" signal AND an "exclusive-non-european"
 * signal for the same phrase; Rule 2 (country list) usually wins when the phrase is
 * in a decisive field (title/locationRaw/structured) so this went unnoticed, but a
 * description-only mention hit Rule 3 first and got wrongly excluded.
 */
export const EXCLUSIVE_NON_EUROPEAN_REGION_PHRASES: string[] = [
  "latam only",
  "latin america only",
  "apac only",
  "asia pacific only",
  "asia-pacific only",
  "middle east only",
];

export const TIMEZONE_PHRASES: string[] = [
  "cet",
  "cest",
  "wet",
  "west",
  "eet",
  "eest",
  "gmt+0",
  "gmt+1",
  "gmt+2",
  "gmt+3",
  "utc+0",
  "utc+1",
  "utc+2",
  "utc+3",
  "european business hours",
  "european working hours",
  "european timezone",
  "european time zone",
];

export const WEAK_COMPANY_PHRASES: string[] = [
  "european team",
  "our european team",
  "offices throughout europe",
  "offices across europe",
  "offices in europe",
  "european offices",
  "pan-european",
  "hubs across europe",
  "hubs throughout europe",
];

/** Short, otherwise-ambiguous country codes trusted only as isolated UPPERCASE tokens. */
export const UPPERCASE_SHORT_COUNTRY_CODES: Record<string, string> = {
  US: "US",
  USA: "US",
  UK: "GB",
  UAE: "AE",
  CA: "CA",
  NZ: "NZ",
};
