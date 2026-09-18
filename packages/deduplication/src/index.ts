export type {
  GeographyConfidence,
  JobCandidate,
  ScoringWeights,
  DeduplicationConfig,
  CandidateScore,
  MatchDecision,
} from "./types.js";

export { DEFAULT_DEDUPLICATION_CONFIG } from "./config.js";
export { normalizeCompanyName, normalizeApplyUrl } from "./textNormalize.js";
export { trigramSimilarity } from "./similarity.js";
export { findBestMatch } from "./findBestMatch.js";
