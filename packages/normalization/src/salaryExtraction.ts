import type { SalaryExtractionResult, SalaryPeriod } from "./types.js";

const CURRENCY_SYMBOL_MAP: Record<string, string> = { "€": "EUR", "$": "USD", "£": "GBP" };
const CURRENCY_CODES = ["EUR", "USD", "GBP", "PLN", "CHF", "SEK", "NOK", "DKK", "CZK", "RON", "HUF"];

const PERIOD_KEYWORDS: Array<{ period: SalaryPeriod; keywords: string[] }> = [
  { period: "HOURLY", keywords: ["/hour", "/hr", "per hour", "hourly"] },
  { period: "DAILY", keywords: ["/day", "per day", "daily"] },
  { period: "MONTHLY", keywords: ["/month", "/mo", "per month", "monthly", "mies", "/mies"] },
  {
    period: "YEARLY",
    keywords: ["/year", "/yr", "per year", "per annum", "annum", "yearly", "annually"],
  },
];

// A number is either a comma/space-grouped figure (each group exactly 3 digits, and
// never followed by a further stray digit — this stops "50,000 2024" from being read
// as one number) or a plain contiguous digit run, with an optional decimal tail.
const NUM = String.raw`\d+(?:[,\s]\d{3}(?!\d))*(?:\.\d+)?`;
const CURRENCY = [String.raw`€`, String.raw`\$`, String.raw`£`, ...CURRENCY_CODES].join("|");

const SALARY_SPAN_PATTERN = new RegExp(
  String.raw`(?<c1>${CURRENCY})\s?(?<n1>${NUM})(?<k1>k)?` +
    String.raw`(?:\s*(?:-|–|—|to)\s*(?:(?<c2>${CURRENCY})\s?)?(?<n2>${NUM})(?<k2>k)?)?`,
  "i",
);

function parseNumber(raw: string, hasK: boolean): number {
  const digits = raw.replace(/[,\s]/g, "");
  const value = Number(digits);
  return hasK ? value * 1000 : value;
}

function resolveCurrency(token: string): string {
  const symbolMatch = CURRENCY_SYMBOL_MAP[token];
  if (symbolMatch) return symbolMatch;
  return token.toUpperCase();
}

function findPeriod(context: string): SalaryPeriod | null {
  const lower = context.toLowerCase();
  for (const { period, keywords } of PERIOD_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return period;
  }
  return null;
}

const EMPTY_RESULT: SalaryExtractionResult = {
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
};

/**
 * Parses a salary-shaped string (e.g. a compensation line, or a short snippet
 * already isolated from a longer description) into structured fields. Deliberately
 * scoped to salary-shaped input, not general free-text scanning — running this
 * against an entire multi-paragraph description risks picking up unrelated figures
 * (funding amounts, percentages, dates). Callers extract the relevant line/field
 * first (source-provided structured salary fields should be preferred entirely when
 * available — this parser exists for sources that only provide free text).
 *
 * Never guesses a period: if no explicit period keyword is present, `salaryPeriod`
 * is left `null` even though `salaryMin`/`salaryMax`/`salaryCurrency` are populated —
 * a missing field beats a wrong one (docs/ingestion.md §5.3).
 */
export function extractSalary(text: string | undefined | null): SalaryExtractionResult {
  if (!text || !text.trim()) return EMPTY_RESULT;

  const match = SALARY_SPAN_PATTERN.exec(text);
  if (!match?.groups) return EMPTY_RESULT;

  const { c1, n1, k1, c2, n2, k2 } = match.groups;
  if (!c1 || !n1) return EMPTY_RESULT;

  const currency = resolveCurrency(c2 ?? c1);
  const first = parseNumber(n1, Boolean(k1));

  if (n2) {
    const second = parseNumber(n2, Boolean(k2));
    const salaryMin = Math.min(first, second);
    const salaryMax = Math.max(first, second);
    return { salaryMin, salaryMax, salaryCurrency: currency, salaryPeriod: findPeriod(text) };
  }

  return { salaryMin: first, salaryMax: first, salaryCurrency: currency, salaryPeriod: findPeriod(text) };
}
