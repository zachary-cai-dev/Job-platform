import { EXACT_CASE_TECHNOLOGY, TECHNOLOGIES } from "./data/technologies.js";
import { phraseMatches } from "./textMatch.js";
import type { ExtractedTechnology } from "./types.js";

const TECH_BY_SLUG = new Map(TECHNOLOGIES.map((t) => [t.slug, t]));

/** Longest alias first, so "large language models" is tried before "llm" etc. — not
 * load-bearing for correctness here (each technology is matched independently) but
 * keeps `matchedPhrase` reporting the more specific alias when both would match. */
const ALIAS_ENTRIES = TECHNOLOGIES.flatMap((tech) =>
  tech.aliases.map((alias) => ({ slug: tech.slug, alias })),
).sort((a, b) => b.alias.length - a.alias.length);

function exactCaseTokenMatches(rawText: string, token: string): boolean {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${token}(?![A-Za-z0-9])`);
  return pattern.test(rawText);
}

/**
 * Extracts canonical technologies from free text (title + description). Matching is
 * case-insensitive and word-boundary-safe for ordinary aliases; the single
 * genuinely ambiguous entry ("Go") is matched only as an exact-case token to avoid
 * matching the ordinary verb "go" (see docs/ingestion.md §5.2).
 */
export function extractTechnologies(...texts: Array<string | undefined | null>): ExtractedTechnology[] {
  const combinedRaw = texts.filter((t): t is string => Boolean(t && t.trim())).join("\n");
  if (!combinedRaw) return [];

  const lower = combinedRaw.toLowerCase();
  const foundSlugs = new Map<string, string>(); // slug -> matched phrase

  for (const { slug, alias } of ALIAS_ENTRIES) {
    if (foundSlugs.has(slug)) continue;
    if (phraseMatches(lower, alias)) {
      foundSlugs.set(slug, alias);
    }
  }

  if (!foundSlugs.has(EXACT_CASE_TECHNOLOGY.slug) && exactCaseTokenMatches(combinedRaw, EXACT_CASE_TECHNOLOGY.token)) {
    foundSlugs.set(EXACT_CASE_TECHNOLOGY.slug, EXACT_CASE_TECHNOLOGY.token);
  }

  return [...foundSlugs.entries()].map(([slug, matchedPhrase]) => {
    const tech = TECH_BY_SLUG.get(slug);
    return {
      slug,
      displayName: tech?.displayName ?? slug,
      matchedPhrase,
    };
  });
}
