-- A company's ATS board lists every open req (Sales, Legal, Support, Marketing...),
-- not just engineering ones, and this product is scoped to tech roles specifically.
-- Titles that don't match any known role category get a distinct terminal status
-- instead of silently landing in the feed as roleCategory "OTHER".
ALTER TYPE "ProcessingStatus" ADD VALUE 'REJECTED_ROLE_CATEGORY';

ALTER TABLE "ingestion_runs" ADD COLUMN "rejectedRoleCategoryCount" INTEGER NOT NULL DEFAULT 0;
