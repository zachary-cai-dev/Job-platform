import { COUNTRY_BY_CODE, COUNTRY_NAME_INDEX } from "./data/countries.js";
import {
  REGION_PHRASES,
  WORLDWIDE_PHRASES,
  EXCLUSIVE_NON_EUROPEAN_REGION_PHRASES,
  TIMEZONE_PHRASES,
  WEAK_COMPANY_PHRASES,
  UPPERCASE_SHORT_COUNTRY_CODES,
  US_ELIGIBILITY_PHRASES,
} from "./data/phrases.js";
import type { LocationField, LocationSignal, NormalizedLocation, RegionCode } from "./types.js";

const EXCLUSIVITY_MARKERS = [
  "only",
  "must be based in",
  "must reside in",
  "must be located in",
  "exclusively",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches `phrase` in `lowerText` as a whole phrase (not a substring of a longer word). */
function phraseMatches(lowerText: string, phrase: string): boolean {
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(phrase)}(?![a-z0-9])`, "i");
  return pattern.test(lowerText);
}

function findPhraseMatches(lowerText: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => phraseMatches(lowerText, phrase));
}

function findCountryNameMatches(lowerText: string): Array<{ phrase: string; code: string }> {
  const matches: Array<{ phrase: string; code: string }> = [];
  for (const [phrase, code] of COUNTRY_NAME_INDEX) {
    if (phraseMatches(lowerText, phrase)) {
      matches.push({ phrase, code });
    }
  }
  return matches;
}

/**
 * Short country codes (US, UK, UAE, ...) are only trusted as isolated uppercase
 * tokens in the original text — never pattern-matched against lowercase prose,
 * to avoid false positives like the pronoun "us" or the preposition "in".
 */
function findUppercaseShortCodeMatches(
  rawText: string,
  field: LocationField,
): Array<{ phrase: string; code: string }> {
  const withoutDots = rawText.replace(/\b([A-Z])\.(?=[A-Z]\.?\b)/g, "$1");
  const tokens = withoutDots.match(/\b[A-Z]{2,4}\b/g) ?? [];
  const matches: Array<{ phrase: string; code: string }> = [];
  for (const token of tokens) {
    // An ISO code in a dedicated location field is unambiguous (`London, GB`,
    // `Bengaluru, IN`). In titles/descriptions, short tokens such as IT/IN/NO are
    // ordinary words or role abbreviations, so retain the deliberately small safe
    // allowlist there.
    const code = field === "locationRaw" || field === "structured"
      ? COUNTRY_BY_CODE.get(token)?.code
      : UPPERCASE_SHORT_COUNTRY_CODES[token];
    if (code) matches.push({ phrase: token, code });
  }
  return matches;
}

export function normalizeLocation(
  rawText: string | undefined | null,
  field: LocationField = "locationRaw",
): NormalizedLocation {
  if (!rawText || !rawText.trim()) {
    return { regions: [], countries: [], isWorldwide: false, isExclusiveList: false, signals: [] };
  }

  const lower = rawText.toLowerCase();
  const signals: LocationSignal[] = [];
  const regions = new Set<RegionCode>();
  const countries = new Set<string>();
  let isWorldwide = false;

  for (const region of Object.keys(REGION_PHRASES) as Array<keyof typeof REGION_PHRASES>) {
    for (const phrase of findPhraseMatches(lower, REGION_PHRASES[region])) {
      regions.add(region);
      signals.push({ phrase, field, kind: "region", value: region });
    }
  }

  for (const phrase of findPhraseMatches(lower, WORLDWIDE_PHRASES)) {
    isWorldwide = true;
    signals.push({ phrase, field, kind: "worldwide", value: "WORLDWIDE" });
  }

  for (const phrase of findPhraseMatches(lower, US_ELIGIBILITY_PHRASES)) {
    countries.add("US");
    // "us-eligible", not "country" — these are broad region-style phrases ("remote
    // north america", not a named country), so evaluateEuropeanEligibility.ts scans
    // for them across every field the same way it does "region" signals, instead of
    // only trusting them in a decisive field the way a plain country mention is.
    signals.push({ phrase, field, kind: "us-eligible", value: "US" });
  }

  for (const phrase of findPhraseMatches(lower, EXCLUSIVE_NON_EUROPEAN_REGION_PHRASES)) {
    signals.push({ phrase, field, kind: "exclusive-non-european", value: null });
  }

  for (const { phrase, code } of findCountryNameMatches(lower)) {
    countries.add(code);
    signals.push({ phrase, field, kind: "country", value: code });
  }

  for (const { phrase, code } of findUppercaseShortCodeMatches(rawText, field)) {
    if (!countries.has(code)) {
      countries.add(code);
      signals.push({ phrase, field, kind: "country", value: code });
    }
  }

  for (const phrase of findPhraseMatches(lower, TIMEZONE_PHRASES)) {
    signals.push({ phrase, field, kind: "timezone", value: null });
  }

  for (const phrase of findPhraseMatches(lower, WEAK_COMPANY_PHRASES)) {
    signals.push({ phrase, field, kind: "weak-company", value: null });
  }

  const isExclusiveList = EXCLUSIVITY_MARKERS.some((marker) => lower.includes(marker));

  return {
    regions: [...regions],
    countries: [...countries],
    isWorldwide,
    isExclusiveList,
    signals,
  };
}
