# Geography — `packages/geography`

This package is the single source of truth for "is a European (or US-remote — see §4's
`isSupportedCountry`) candidate eligible for this job." Nothing outside this package is
allowed to encode geographic logic — every other module (normalization, dedup, API
filters, admin) calls into it.

The package is **pure**: no I/O, no database, no network. That's what lets it be
exhaustively unit tested against the examples in the product brief.

## 1. Region model

Five normalized regions. They are **not** interchangeable — a country can be in one
without being in another.

| Region | Meaning |
|---|---|
| `EUROPE` | Geographic/cultural Europe |
| `EU` | European Union member state |
| `EEA` | European Economic Area (EU + Iceland, Liechtenstein, Norway) |
| `EMEA` | Europe + Middle East + Africa (superset used loosely by employers) |
| `WORLDWIDE` | No geographic restriction stated |

Every EU country is EEA, EMEA, and Europe. Every EEA country is EMEA and Europe, but
not necessarily EU (Norway, Iceland, Liechtenstein). The UK and Switzerland are Europe
and EMEA, but neither EU nor EEA. `WORLDWIDE` is not a country property — it's a
property of a *job posting*, meaning no restriction was expressed.

## 2. Country → region data

Source of truth: `packages/geography/src/data/countries.ts`, one row per ISO 3166-1
alpha-2 code with explicit boolean flags. Never derive regions from country names at
runtime — the table is static, versioned data, reviewed like code.

### 2.1 EU member states (27) — EU, EEA, EMEA, Europe all `true`

`AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE`

(Austria, Belgium, Bulgaria, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland,
France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta,
Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden)

### 2.2 EEA, non-EU (3) — EEA, EMEA, Europe `true`; EU `false`

`IS LI NO` (Iceland, Liechtenstein, Norway)

### 2.3 Europe, non-EU/non-EEA — EMEA, Europe `true`; EU, EEA `false`

`GB CH AL AD BY BA FO GI GG IM JE XK MD MC ME MK RU SM RS UA VA`

(United Kingdom, Switzerland, Albania, Andorra, Belarus, Bosnia and Herzegovina, Faroe
Islands, Gibraltar, Guernsey, Isle of Man, Jersey, Kosovo, Moldova, Monaco, Montenegro,
North Macedonia, Russia, San Marino, Serbia, Ukraine, Vatican City)

**Transcontinental note:** Turkey (TR), Georgia (GE), Armenia (AM), Azerbaijan (AZ),
Cyprus is already EU) — Turkey/Georgia/Armenia/Azerbaijan are flagged
`isEurope: false, isEMEA: true` by default (commonly marketed as EMEA, rarely as
"Europe" by employers). This is a judgment call recorded here so it can be revisited;
it does not block a job that explicitly names one of these countries alongside a
genuine European one.

### 2.4 Middle East & Africa (EMEA-only) — EMEA `true`; Europe/EU/EEA `false`

Populated from the standard UN M49 "Northern Africa", "Sub-Saharan Africa", and
"Western Asia" (Middle East) country lists — not hand-transcribed here to avoid
transcription drift. Examples: `AE SA IL EG ZA NG KE MA QA` etc. This block only
matters for `isEMEACountry()`; since the product's *only* qualifying regions are
Europe/EU/EEA/EMEA, a job restricted to e.g. "UAE only" is correctly excluded by the
eligibility algorithm (§4) even though UAE is EMEA — EMEA-only mention of a
non-European EMEA country does not itself make **Europe** eligible; see §4 rule 3b.

### 2.5 Data shape

```ts
interface CountryRegionInfo {
  code: string;        // ISO 3166-1 alpha-2, uppercase
  name: string;         // canonical English name
  aliases: string[];    // "UK", "Great Britain", "Czech Republic", "Holland", ...
  isEurope: boolean;
  isEU: boolean;
  isEEA: boolean;
  isEMEA: boolean;
}
```

## 3. Public API (`packages/geography`)

```ts
type RegionCode = 'EUROPE' | 'EU' | 'EEA' | 'EMEA' | 'WORLDWIDE';
type CountryCode = string; // ISO 3166-1 alpha-2

function isEuropeanCountry(code: CountryCode): boolean;
function isEUCountry(code: CountryCode): boolean;
function isEEACountry(code: CountryCode): boolean;
function isEMEACountry(code: CountryCode): boolean;
function getRegionsForCountry(code: CountryCode): RegionCode[];

// Not itself exported — a local wrapper inside evaluateEuropeanEligibility.ts,
// listed here because it's what §4's rules actually gate eligibility on.
function isSupportedCountry(code: CountryCode): boolean; // isEuropeanCountry(code) || code === 'US'

interface LocationSignal {
  phrase: string;                 // the exact substring matched
  field: 'title' | 'locationRaw' | 'description' | 'structured';
  kind: 'region' | 'country' | 'us-eligible' | 'worldwide' | 'exclusive-non-european' | 'timezone' | 'weak-company';
  value: RegionCode | CountryCode | null;
}

interface NormalizedLocation {
  regions: RegionCode[];
  countries: CountryCode[];
  isWorldwide: boolean;
  isExclusiveList: boolean;       // "only" / "must be based in" language detected
  signals: LocationSignal[];
}

function normalizeLocation(rawText: string, field?: LocationSignal['field']): NormalizedLocation;

type GeographyConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface EligibilityResult {
  eligible: boolean;
  eligibleRegions: RegionCode[];
  eligibleCountries: CountryCode[];
  confidence: GeographyConfidence;
  reason: string;                 // human-readable, stored as `geographyReason`
  signals: LocationSignal[];      // full provenance for debugging/admin
}

function evaluateEuropeanEligibility(input: {
  locationRaw?: string;
  title?: string;
  descriptionText?: string;
  structuredLocations?: string[]; // e.g. Greenhouse/Lever office/location metadata
}): EligibilityResult;
```

`evaluateEuropeanEligibility` scans `structuredLocations` first (most trustworthy —
sources like Greenhouse/Lever often provide a discrete office/location list), then
`locationRaw`, then `title`, then `descriptionText`, combining every signal found. It
never stops at the first field; it returns the **highest-confidence** decision across
all fields, with `signals` showing exactly what was matched and where, so the admin UI
and tests can show *why*.

## 4. Eligibility algorithm

Evaluated as an **ordered rule list** — first matching rule wins. A rule-list (not a
weighted score) is used deliberately: the inclusion/exclusion decision needs to be
explainable and testable against the brief's exact examples, not probabilistic.

```
signals = normalizeLocation(structuredLocations) + normalizeLocation(locationRaw)
        + normalizeLocation(title) + normalizeLocation(descriptionText)

isSupportedCountry(code) = isEuropeanCountry(code) OR code == "US"

1. If any signal is an explicit region keyword EUROPE | EU | EEA | EMEA
   → INCLUDE, HIGH, reason: "Explicit region keyword: <region>" (matched phrase)

1b. If a broad North America / US eligibility phrase matched, in ANY field
    (not just a decisive one — "remote north america", "north america remote",
    "north america only", "anywhere in north america") — treated like rule 1's
    region keywords rather than rule 2's plain country mentions, since these are
    region-style statements even though they resolve to a single country:
    → INCLUDE, HIGH, countries include "US" (plus any supported countries already
      found in a decisive field), reason: "Broad North America eligibility
      phrase: <phrase>"

2. If country codes were extracted from a location-bearing field
   (structuredLocations or locationRaw; title/description country mentions are
   treated as weaker, see rule 5):
     a. If at least one extracted country is supported (isSupportedCountry —
        European OR US)
        → INCLUDE, HIGH, reason: "Includes supported countr(y/ies): <codes>"
          (this is true regardless of whether unsupported countries are also listed —
          "Remote US, Canada, UK and Germany" includes US/DE/GB, drops Canada → INCLUDE)
     b. Else (countries were extracted and NONE are supported)
        → EXCLUDE, HIGH, reason: "Restricted to unsupported countr(y/ies): <codes>"
          (true whether or not "only" is present — "Remote Canada" excludes on its own)

3. If a known exclusive non-European/non-US region phrase matched with no
   accompanying supported country/region signal (e.g. "APAC only", "LATAM
   only", "Australia only", "India only")
   → EXCLUDE, HIGH, reason: "Restricted to non-European region: <phrase>"

4. If a worldwide/global phrase matched ("worldwide", "anywhere", "global remote")
   and no rule above already produced an EXCLUDE
   → INCLUDE, HIGH, reason: "Worldwide remote with no exclusion of Europe"

5. If only weak/ambiguous signals matched:
     - timezone-only phrases (CET, CEST, WET, EET, "GMT+0..+3", "European business
       hours") → MEDIUM, reason: "Timezone signal suggests Europe: <phrase>"
     - vague company/team language ("European team", "offices throughout Europe",
       "we have hubs across Europe") → LOW, reason: "Non-committal company/team
       language, not a candidate-location statement: <phrase>"

6. If no location signal was found at all
   → EXCLUDE, LOW, reason: "No parseable location signal"
```

(Rule numbers here match the code's own comments 1:1 — see
`packages/geography/src/evaluateEuropeanEligibility.ts`'s "Rule 1", "Rule 1b",
"Rule 2", ... labels.)

Rule 2 deliberately does not require the word "only" — the brief's examples show
`"Remote Canada"` excluded and `"Remote US, Canada, UK and Germany"` included purely
from which countries are named, not from restrictive language. "Only"/"must be based
in"/"exclusively" is tracked (`isExclusiveList`) and surfaced in `signals` for the
admin UI and future scoring refinement, but the current algorithm doesn't need it to
hit the brief's examples.

Rule 1b exists as its own step, ahead of rule 2, specifically because a plain country
mention is only trusted from a decisive field (structuredLocations/locationRaw/title —
see rule 2's parenthetical), but a US eligibility *phrase* ("remote north america") is
a region-style statement, not a bare country name, so it's trusted from any field —
including a restriction stated only in the free-text description, which a decisive-
field-only check would otherwise miss entirely.

### 4.1 Confidence → publishing policy

| Confidence | Behavior |
|---|---|
| HIGH | Published into the main Europe feed. |
| MEDIUM | Published, but only when it is the *decision-making* signal — i.e. no HIGH signal exists to override it (an explicit "APAC only" HIGH-EXCLUDE elsewhere still wins). |
| LOW | **Not** published into the main feed. Stored with `isActive = true` at the row level but excluded from default search results (a `geographyConfidence = LOW` filter), unless a HIGH or MEDIUM signal exists elsewhere in the same job that corroborates eligibility — in which case the corroborating signal's confidence is used instead. |

This directly implements the brief's rule: *"Do not automatically publish
LOW-confidence jobs into the main Europe feed unless another signal confirms
eligibility."*

### 4.2 Worked examples (also the seed of the test suite, see §6)

| Input | Result |
|---|---|
| `"Remote Europe"` | INCLUDE, HIGH — region keyword |
| `"Remote EU"` | INCLUDE, HIGH — region keyword |
| `"Remote EEA"` | INCLUDE, HIGH — region keyword |
| `"Remote EMEA"` | INCLUDE, HIGH — region keyword |
| `"Remote Germany"` | INCLUDE, HIGH — DE is European |
| `"Remote UK"` | INCLUDE, HIGH — GB is European |
| `"Remote Germany, Spain and France"` | INCLUDE, HIGH — DE/ES/FR European |
| `"Remote US, Canada, UK and Germany"` | INCLUDE, HIGH — US/GB/DE present, Canada dropped |
| `"Remote worldwide"` | INCLUDE, HIGH — worldwide, no exclusion |
| `"Remote anywhere"` (no conflicting restriction) | INCLUDE, HIGH |
| `"US only"` | INCLUDE, HIGH — US is a supported country |
| `"Remote US"` | INCLUDE, HIGH — US is a supported country |
| `"US and Canada only"` | INCLUDE, HIGH — US present, Canada dropped |
| `"North America only"` | INCLUDE, HIGH — broad US-eligibility phrase, `eligibleCountries: ["US"]` |
| `"Remote North America"` (mentioned only in the description, not the title/location field) | INCLUDE, HIGH — the broad-phrase rule (§4 rule 1b) is scanned across every field, unlike a plain country mention |
| `"Canada only"` | EXCLUDE, HIGH — Canada is not a supported country |
| `"LATAM only"` | EXCLUDE, HIGH |
| `"APAC only"` | EXCLUDE, HIGH |
| `"Australia only"` | EXCLUDE, HIGH |
| `"India only"` | EXCLUDE, HIGH |
| `"Candidates must be located in the EU"` | INCLUDE, HIGH |
| `"Remote within Europe"` | INCLUDE, HIGH |
| `"Remote UK / Germany / France"` | INCLUDE, HIGH |
| `"European team"` | Not published alone — LOW |
| `"We have offices throughout Europe"` | Not published alone — LOW |
| `"Timezone preference: CET"` | Published — MEDIUM |

## 5. Parsing strategy (`normalizeLocation`)

1. **Region keyword dictionary** — regex alternation over the exact phrasings listed
   in the brief (`remote europe`, `europe remote`, `remote - europe`, `anywhere in
   europe`, `work from anywhere in europe`, `european candidates`, `candidates based
   in europe`, `remote eu`, `eu remote`, `remote within the eu`, `european union`,
   `eu residents`, `eu-based candidates`, `remote eea`, `eea remote`, `european
   economic area`, `candidates located within the eea`, `remote emea`, `emea
   remote`, `candidates based in emea`, `emea region`, etc.), case-insensitive,
   word-boundary anchored.
2. **Country matching**:
   - Full country names and well-known aliases (`UK`, `Great Britain`,
     `Czech Republic`/`Czechia`, `Holland`/`Netherlands`) matched case-insensitively
     as whole words/phrases against the alias table in §2.5.
   - Bare ISO alpha-2 codes (`DE`, `FR`, `NL`...) are **only** trusted when they come
     from a `structured` field/source metadata, or appear uppercase in a clearly
     location-shaped context (e.g. after "Remote -", in a comma-separated list). They
     are never pattern-matched against arbitrary lowercase description prose, to avoid
     false positives like the word "in" (India's code) or "it" (Italy's code, unrelated
     to source list boundary issues — actual code is `IT` but this illustrates the
     class of risk generally).
   - List separators handled: `,` `/` `&` `and` `or` `-` (`"Remote - Germany, France,
     Netherlands"`, `"UK and Ireland"`, `"Spain, Portugal, Germany or Poland"`).
3. **US eligibility phrase dictionary** — `remote north america`, `north america
   remote`, `north america only`, `anywhere in north america`. Unlike a plain
   country mention, these are matched across every field (title/locationRaw/
   structured/description alike) and resolve to `eligibleCountries: ["US"]` —
   see §4 rule 1b. Deliberately **not** also listed in the exclusive
   non-European dictionary below; a phrase can't mean both "include via US" and
   "exclude as non-European" at once.
4. **Exclusive non-European/non-US region/country phrase dictionary** — curated
   list: `latam only`, `latin america only`, `apac only`, `asia pacific only`,
   `asia-pacific only`, `middle east only`, and equivalents. This dictionary
   exists to catch region-level exclusions (APAC, LATAM, Middle East) that
   aren't expressible as a single ISO country code.
5. **Worldwide phrase dictionary** — `worldwide`, `anywhere`, `global remote`,
   `remote - global`.
6. **Timezone dictionary** (MEDIUM signal) — `CET`, `CEST`, `WET`, `WEST`, `EET`,
   `EEST`, `GMT+0`…`GMT+3`, `UTC+0`…`UTC+3`, `"European business hours"`, `"European
   working hours"`.
7. **Weak company-language dictionary** (LOW signal) — `european team`, `offices
   (throughout|across|in) europe`, `european offices`, `pan-european`.

Every dictionary lives as versioned data (`packages/geography/src/data/phrases.ts`),
not scattered regexes — adding a new phrasing is a data change, not a code change.

## 6. Test coverage

`packages/geography` ships a table-driven test suite covering every example in §4.2
plus:

- Mixed-case and punctuation variants of each phrase.
- Country lists with 1, 2, and 5+ members, European and non-European mixed.
- Structured-field vs. free-text precedence (structured wins when present).
- Multi-field corroboration (LOW in `locationRaw`, HIGH in `descriptionText` →
  overall HIGH).
- Negative cases that must **not** false-positive: e.g. "Germany" appearing only in a
  company's history/founding-story paragraph, not as a location statement (mitigated
  by field weighting — title/locationRaw/structured outrank description mentions,
  and description-only country mentions without a location-shaped context around them
  are treated as LOW, not HIGH).

This package's test suite is the acceptance gate — no adapter or pipeline change ships
if it regresses these cases.
