export type GeographyConfidence = "HIGH" | "MEDIUM" | "LOW";

/**
 * The minimal shape the deduplication engine needs from a canonical Job (or an
 * incoming normalized listing being considered for merge). Deliberately narrow and
 * decoupled from `packages/db`'s Prisma types so this package stays pure/DB-free.
 */
export interface JobCandidate {
  id: string;
  companyName: string;
  normalizedTitle: string;
  applyUrl: string;
  descriptionText: string;
  eligibleCountries: string[];
  eligibleRegions: string[];
  geographyConfidence: GeographyConfidence;
}

export interface ScoringWeights {
  companyMatch: number;
  titleMatch: number;
  applyUrlMatch: number;
  descriptionSimilarity: number;
  locationCompatibility: number;
}

export interface DeduplicationConfig {
  weights: ScoringWeights;
  mergeThreshold: number;
  titleSimilarityThreshold: number;
  descriptionSimilarityThreshold: number;
  /** A job is "narrow" (location-veto-eligible) when it names this many countries or fewer. */
  narrowCountryCountThreshold: number;
}

export interface CandidateScore {
  candidate: JobCandidate;
  score: number;
  reasons: string[];
}

export interface MatchDecision {
  action: "MERGE" | "CREATE_NEW";
  matchedCandidateId: string | null;
  score: number;
  reasons: string[];
  /** Candidates that were disqualified outright before scoring, with why. */
  vetoed: Array<{ candidateId: string; reason: string }>;
}
