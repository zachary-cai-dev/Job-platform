-- fingerprint is a candidate-narrowing signal for dedup, not the authoritative
-- identity (packages/deduplication's scoring engine is) — two genuinely different,
-- currently open reqs can legitimately share the same company+title+location hash,
-- so this must not be a hard uniqueness constraint. Replace the unique index with a
-- plain lookup index.
DROP INDEX "jobs_fingerprint_key";
CREATE INDEX "jobs_fingerprint_idx" ON "jobs" ("fingerprint");
