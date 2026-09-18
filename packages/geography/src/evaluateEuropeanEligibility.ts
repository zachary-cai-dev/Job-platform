import { isEuropeanCountry, getRegionsForCountry } from "./countryQueries.js";
import { normalizeLocation } from "./normalizeLocation.js";
import type {
  EligibilityInput,
  EligibilityResult,
  GeographyConfidence,
  LocationSignal,
  NormalizedLocation,
  RegionCode,
} from "./types.js";

function isSupportedCountry(code: string): boolean {
  return code === "US" || isEuropeanCountry(code);
}

function uniqueCountries(locs: NormalizedLocation[]): string[] {
  const set = new Set<string>();
  for (const loc of locs) for (const c of loc.countries) set.add(c);
  return [...set];
}

function uniqueRegions(locs: NormalizedLocation[]): RegionCode[] {
  const set = new Set<RegionCode>();
  for (const loc of locs) for (const r of loc.regions) set.add(r);
  return [...set];
}

function findFirstSignal(
  locs: NormalizedLocation[],
  predicate: (signal: LocationSignal) => boolean,
): LocationSignal | undefined {
  for (const loc of locs) {
    const found = loc.signals.find(predicate);
    if (found) return found;
  }
  return undefined;
}

function collectSignals(
  locs: NormalizedLocation[],
  predicate: (signal: LocationSignal) => boolean,
): LocationSignal[] {
  return locs.flatMap((loc) => loc.signals.filter(predicate));
}

function withImpliedRegions(eligibleCountries: string[], explicitRegions: RegionCode[]): RegionCode[] {
  const set = new Set<RegionCode>(explicitRegions);
  for (const code of eligibleCountries) {
    for (const region of getRegionsForCountry(code)) set.add(region);
  }
  return [...set];
}

function include(params: {
  regions: RegionCode[];
  countries: string[];
  confidence: GeographyConfidence;
  reason: string;
  signals: LocationSignal[];
}): EligibilityResult {
  return {
    eligible: true,
    eligibleRegions: withImpliedRegions(params.countries, params.regions),
    eligibleCountries: params.countries,
    confidence: params.confidence,
    reason: params.reason,
    signals: params.signals,
  };
}

function exclude(params: {
  confidence: GeographyConfidence;
  reason: string;
  signals: LocationSignal[];
}): EligibilityResult {
  return {
    eligible: false,
    eligibleRegions: [],
    eligibleCountries: [],
    confidence: params.confidence,
    reason: params.reason,
    signals: params.signals,
  };
}

/**
 * Ordered rule list — first matching rule wins. See docs/geography.md §4 for the
 * full rationale and the worked example table this implementation is tested against.
 *
 * "Decisive" fields (structuredLocations, locationRaw, title) are trusted for the
 * country-list rule (§4 rule 2); descriptionText country mentions are informational
 * only (not decisive) to avoid false positives from prose mentioning a country-shaped
 * word that isn't actually a location statement (a person named "Jordan", a US state
 * "Georgia", etc.). Region-keyword, worldwide, exclusive-region, timezone, and
 * weak-company phrases are scanned across every field — those phrase dictionaries are
 * distinctive multi-word patterns with much lower false-positive risk.
 */
export function evaluateEuropeanEligibility(input: EligibilityInput): EligibilityResult {
  const structuredNorms = (input.structuredLocations ?? []).map((text) =>
    normalizeLocation(text, "structured"),
  );
  const locationRawNorm = normalizeLocation(input.locationRaw, "locationRaw");
  const titleNorm = normalizeLocation(input.title, "title");
  const descriptionNorm = normalizeLocation(input.descriptionText, "description");

  const decisiveFields = [...structuredNorms, locationRawNorm, titleNorm];
  const allFields = [...decisiveFields, descriptionNorm];

  // Rule 1: explicit region keyword, any field.
  const regionSignal = findFirstSignal(allFields, (s) => s.kind === "region");
  if (regionSignal) {
    const decisiveCountries = uniqueCountries(decisiveFields).filter(isSupportedCountry);
    return include({
      regions: uniqueRegions(allFields),
      countries: decisiveCountries,
      confidence: "HIGH",
      reason: `Explicit region keyword: "${regionSignal.phrase}" (${String(regionSignal.value)})`,
      signals: collectSignals(allFields, (s) => s.kind === "region"),
    });
  }

  // Rule 1b: broad North America / US eligibility phrase, any field — same
  // treatment as Rule 1's region keywords (scanned everywhere, not just decisive
  // fields). These phrases ("remote north america", "north america only", ...)
  // are region-style statements even though they resolve to a single country
  // (US) rather than a RegionCode, so — unlike a plain country mention (Rule 2,
  // decisive fields only) — a mention buried only in the description still counts.
  const usEligibleSignal = findFirstSignal(allFields, (s) => s.kind === "us-eligible");
  if (usEligibleSignal) {
    const decisiveSupported = uniqueCountries(decisiveFields).filter(isSupportedCountry);
    const countries = [...new Set([...decisiveSupported, "US"])];
    return include({
      regions: uniqueRegions(allFields),
      countries,
      confidence: "HIGH",
      reason: `Broad North America eligibility phrase: "${usEligibleSignal.phrase}"`,
      signals: [usEligibleSignal, ...collectSignals(decisiveFields, (s) => s.kind === "country")],
    });
  }

  // Rule 2: country list extracted from a location-bearing (decisive) field.
  const decisiveCountries = uniqueCountries(decisiveFields);
  if (decisiveCountries.length > 0) {
    const supportedCountries = decisiveCountries.filter(isSupportedCountry);
    if (supportedCountries.length > 0) {
      return include({
        regions: [],
        countries: supportedCountries,
        confidence: "HIGH",
        reason: `Includes supported countr${supportedCountries.length > 1 ? "ies" : "y"}: ${supportedCountries.join(", ")}`,
        signals: collectSignals(decisiveFields, (s) => s.kind === "country"),
      });
    }
    return exclude({
      confidence: "HIGH",
      reason: `Restricted to unsupported countr${decisiveCountries.length > 1 ? "ies" : "y"}: ${decisiveCountries.join(", ")}`,
      signals: collectSignals(decisiveFields, (s) => s.kind === "country"),
    });
  }

  // Rule 3: exclusive non-European region phrase (e.g. "APAC only"), any field.
  const exclusiveSignal = findFirstSignal(allFields, (s) => s.kind === "exclusive-non-european");
  if (exclusiveSignal) {
    return exclude({
      confidence: "HIGH",
      reason: `Restricted to non-European region: "${exclusiveSignal.phrase}"`,
      signals: [exclusiveSignal],
    });
  }

  // Rule 4: worldwide/global phrase, any field.
  const worldwideSignal = findFirstSignal(allFields, (s) => s.kind === "worldwide");
  if (worldwideSignal) {
    return include({
      regions: ["WORLDWIDE"],
      countries: [],
      confidence: "HIGH",
      reason: `Worldwide remote with no exclusion of Europe: "${worldwideSignal.phrase}"`,
      signals: [worldwideSignal],
    });
  }

  // Rule 5a: timezone-only signal (MEDIUM) — published, but not decisive on its own.
  const timezoneSignal = findFirstSignal(allFields, (s) => s.kind === "timezone");
  if (timezoneSignal) {
    return include({
      regions: [],
      countries: [],
      confidence: "MEDIUM",
      reason: `Timezone signal suggests Europe: "${timezoneSignal.phrase}"`,
      signals: [timezoneSignal],
    });
  }

  // Rule 5b: vague company/team language (LOW) — not published without corroboration,
  // and none was found above.
  const weakSignal = findFirstSignal(allFields, (s) => s.kind === "weak-company");
  if (weakSignal) {
    return exclude({
      confidence: "LOW",
      reason: `Non-committal company/team language, not a candidate-location statement: "${weakSignal.phrase}"`,
      signals: [weakSignal],
    });
  }

  // Rule 6: nothing parseable.
  return exclude({
    confidence: "LOW",
    reason: "No parseable location signal",
    signals: [],
  });
}
