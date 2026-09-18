import { DOMAIN_TAGS } from "./data/domainTags.js";
import { OTHER_ROLE_CATEGORY, ROLE_CATEGORIES } from "./data/roleCategories.js";
import { SENIORITY_KEYWORDS, SENIORITY_LABEL } from "./data/seniority.js";
import { findFirstMatch, phraseMatches } from "./textMatch.js";
import type { RoleCategoryDefinition, Seniority, TitleNormalizationResult } from "./types.js";

export function extractSeniority(title: string | undefined | null): Seniority | null {
  if (!title || !title.trim()) return null;
  const lower = title.toLowerCase();
  for (const { level, keywords } of SENIORITY_KEYWORDS) {
    if (findFirstMatch(lower, keywords)) return level;
  }
  return null;
}

function matchRoleCategory(lower: string): RoleCategoryDefinition {
  for (const category of ROLE_CATEGORIES) {
    if (findFirstMatch(lower, category.keywords)) return category;
  }
  return OTHER_ROLE_CATEGORY;
}

function extractDomainTags(lower: string, excludeTags: Set<string>): string[] {
  const tags: string[] = [];
  for (const { tag, keywords } of DOMAIN_TAGS) {
    if (excludeTags.has(tag)) continue;
    if (keywords.some((k) => phraseMatches(lower, k))) tags.push(tag);
  }
  return tags;
}

/**
 * Builds normalized title/category/seniority/tags from a raw job title, per
 * docs/ingestion.md §5.1. Pure function of the title string — deterministic and
 * idempotent so it's fully unit-testable against the brief's worked example.
 */
export function normalizeTitle(rawTitle: string): TitleNormalizationResult {
  const lower = rawTitle.toLowerCase();
  const seniority = extractSeniority(rawTitle);
  const category = matchRoleCategory(lower);
  const domainTags = extractDomainTags(lower, new Set(category.baseTags));
  const tags = [...new Set([...category.baseTags, ...domainTags])];

  // Skip the prefix when it would just repeat a word already in the category label
  // (e.g. seniority MANAGER + ENGINEERING_MANAGEMENT's "Engineering Manager" label
  // would otherwise read as "Manager Engineering Manager").
  const seniorityLabel = seniority ? SENIORITY_LABEL[seniority] : "";
  const seniorityPrefix =
    seniorityLabel && !category.label.toLowerCase().includes(seniorityLabel.toLowerCase()) ? seniorityLabel : "";
  const normalizedTitle =
    category.slug === "OTHER"
      ? rawTitle.trim()
      : [seniorityPrefix, category.label].filter(Boolean).join(" ");

  return {
    normalizedTitle,
    roleCategory: category.slug,
    seniority,
    tags,
  };
}
