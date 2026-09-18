import type { DeduplicationConfig } from "./types.js";

/**
 * Default scoring configuration (docs/ingestion.md §7.3). Isolated here so a
 * stronger signal (e.g. embedding similarity) can be added as one more weighted
 * input later without touching the candidate-generation or decision plumbing.
 */
export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  weights: {
    companyMatch: 40,
    titleMatch: 30,
    applyUrlMatch: 100,
    descriptionSimilarity: 25,
    locationCompatibility: 10,
  },
  mergeThreshold: 70,
  titleSimilarityThreshold: 0.85,
  descriptionSimilarityThreshold: 0.6,
  narrowCountryCountThreshold: 2,
};
