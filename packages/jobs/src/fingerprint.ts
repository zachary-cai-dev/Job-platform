import { createHash } from "node:crypto";

/**
 * hash(company + normalizedTitle + locationDisplay) — a cheap candidate-narrowing
 * signal for dedup, deliberately not treated as a unique identity (see
 * docs/data-model.md §11 and docs/ingestion.md §7). Two genuinely different, open
 * reqs can legitimately collide here; `packages/deduplication`'s scoring engine
 * makes the real merge/no-merge call.
 */
export function computeFingerprint(
  companyName: string,
  normalizedTitle: string,
  locationDisplay: string,
): string {
  const normalized = [companyName, normalizedTitle, locationDisplay]
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}
