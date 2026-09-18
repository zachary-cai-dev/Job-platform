import { DEFAULT_DEDUPLICATION_CONFIG } from "./config.js";
import { trigramSimilarity } from "./similarity.js";
import { normalizeApplyUrl, normalizeCompanyName } from "./textNormalize.js";
import type { CandidateScore, DeduplicationConfig, JobCandidate, MatchDecision } from "./types.js";

function isNarrow(job: JobCandidate, config: DeduplicationConfig): boolean {
  return job.eligibleCountries.length > 0 && job.eligibleCountries.length <= config.narrowCountryCountThreshold;
}

/**
 * Hard veto: two "narrow" (specific, small country-list) listings whose countries
 * don't overlap at all are different reqs, even if company and title match strongly
 * — e.g. a Germany-only posting and a Spain-only posting for the same title/company.
 * A broad region match (EUROPE/EMEA/WORLDWIDE) on either side never triggers this —
 * only genuinely disjoint narrow restrictions do. See docs/ingestion.md §7.2.
 */
function isVetoedByIncompatibleLocation(
  a: JobCandidate,
  b: JobCandidate,
  config: DeduplicationConfig,
): boolean {
  if (!isNarrow(a, config) || !isNarrow(b, config)) return false;
  const overlaps = a.eligibleCountries.some((c) => b.eligibleCountries.includes(c));
  return !overlaps;
}

function locationsCompatible(a: JobCandidate, b: JobCandidate): boolean {
  if (a.eligibleRegions.includes("WORLDWIDE") || b.eligibleRegions.includes("WORLDWIDE")) return true;
  const countryOverlap = a.eligibleCountries.some((c) => b.eligibleCountries.includes(c));
  const regionOverlap = a.eligibleRegions.some((r) => b.eligibleRegions.includes(r));
  return countryOverlap || regionOverlap;
}

function scoreCandidate(
  incoming: JobCandidate,
  candidate: JobCandidate,
  config: DeduplicationConfig,
): CandidateScore {
  const reasons: string[] = [];
  let score = 0;

  if (normalizeApplyUrl(incoming.applyUrl) === normalizeApplyUrl(candidate.applyUrl)) {
    score += config.weights.applyUrlMatch;
    reasons.push("same apply URL");
  }

  if (normalizeCompanyName(incoming.companyName) === normalizeCompanyName(candidate.companyName)) {
    score += config.weights.companyMatch;
    reasons.push("company name match");
  }

  const titleSim = trigramSimilarity(incoming.normalizedTitle, candidate.normalizedTitle);
  if (
    incoming.normalizedTitle.toLowerCase() === candidate.normalizedTitle.toLowerCase() ||
    titleSim >= config.titleSimilarityThreshold
  ) {
    score += config.weights.titleMatch;
    reasons.push(`title match (similarity ${titleSim.toFixed(2)})`);
  }

  const descriptionSim = trigramSimilarity(incoming.descriptionText, candidate.descriptionText);
  if (descriptionSim >= config.descriptionSimilarityThreshold) {
    score += config.weights.descriptionSimilarity;
    reasons.push(`description similarity (${descriptionSim.toFixed(2)})`);
  }

  if (locationsCompatible(incoming, candidate)) {
    score += config.weights.locationCompatibility;
    reasons.push("compatible location");
  }

  return { candidate, score, reasons };
}

/**
 * Decides whether `incoming` (a newly normalized, Europe-eligible listing) should
 * merge into one of `candidates` (a small, already-narrowed set of existing Jobs —
 * see docs/ingestion.md §7.1 for how that set is produced in production) or become
 * a new canonical Job. Assumes `candidates` excludes the trivial "same source +
 * externalId already known" case, which isn't a dedup decision at all.
 */
export function findBestMatch(
  incoming: JobCandidate,
  candidates: JobCandidate[],
  config: DeduplicationConfig = DEFAULT_DEDUPLICATION_CONFIG,
): MatchDecision {
  const vetoed: MatchDecision["vetoed"] = [];
  const scorable: JobCandidate[] = [];

  for (const candidate of candidates) {
    if (isVetoedByIncompatibleLocation(incoming, candidate, config)) {
      vetoed.push({
        candidateId: candidate.id,
        reason: `incompatible narrow locations: [${incoming.eligibleCountries.join(", ")}] vs [${candidate.eligibleCountries.join(", ")}]`,
      });
      continue;
    }
    scorable.push(candidate);
  }

  const scores = scorable
    .map((candidate) => scoreCandidate(incoming, candidate, config))
    .sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (best && best.score >= config.mergeThreshold) {
    return {
      action: "MERGE",
      matchedCandidateId: best.candidate.id,
      score: best.score,
      reasons: best.reasons,
      vetoed,
    };
  }

  return {
    action: "CREATE_NEW",
    matchedCandidateId: null,
    score: best?.score ?? 0,
    reasons: best?.reasons ?? [],
    vetoed,
  };
}
