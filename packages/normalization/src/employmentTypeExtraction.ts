import { EMPLOYMENT_TYPE_KEYWORDS } from "./data/employmentType.js";
import { findFirstMatch } from "./textMatch.js";
import type { EmploymentType } from "./types.js";

/**
 * Never guesses: returns null when no explicit keyword is present, rather than
 * defaulting to PERMANENT (see docs/ingestion.md §5.3).
 */
export function extractEmploymentType(
  ...texts: Array<string | undefined | null>
): EmploymentType | null {
  const combined = texts.filter((t): t is string => Boolean(t && t.trim())).join("\n").toLowerCase();
  if (!combined) return null;

  for (const { type, keywords } of EMPLOYMENT_TYPE_KEYWORDS) {
    if (findFirstMatch(combined, keywords)) return type;
  }
  return null;
}
