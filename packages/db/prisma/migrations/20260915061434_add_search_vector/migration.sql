-- AlterTable
-- Weighted tsvector for full-text search (docs/architecture.md §7). Weighted:
-- title/normalizedTitle (A, highest), skills (B), description (C). Company name lives
-- on a separate table (companies) and isn't reachable from this row-level column —
-- the search API joins/filters on it separately rather than folding it in here.
--
-- Postgres's to_tsvector(regconfig, text) is STABLE, not IMMUTABLE (the search
-- config could in principle change), so it cannot back a `GENERATED ALWAYS AS`
-- column — Postgres rejects that at DDL time. A BEFORE INSERT/UPDATE trigger is the
-- standard, documented way to maintain a derived tsvector column instead.
ALTER TABLE "jobs" ADD COLUMN "searchVector" tsvector;

CREATE FUNCTION jobs_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."normalizedTitle", '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(NEW."skills", ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."descriptionText", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_search_vector_update
  BEFORE INSERT OR UPDATE ON "jobs"
  FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_trigger();

-- CreateIndex
CREATE INDEX "jobs_searchVector_idx" ON "jobs" USING GIN ("searchVector");
