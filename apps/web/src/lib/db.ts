import { getEnv } from "@euro-jobs/config";
import { prisma } from "@euro-jobs/db";
import { PostgresJobSearchService } from "@euro-jobs/search";

/**
 * API routes only ever read (single-statement queries) — the transaction-mode
 * pooled `prisma` singleton is fine here (unlike apps/worker's writes, which need
 * the session-mode pooler; see docs/architecture.md §5.1).
 */
export function getPrisma() {
  // Validates env once per process, even though we don't need the returned value here.
  getEnv();
  return prisma;
}

let searchService: PostgresJobSearchService | undefined;

export function getSearchService(): PostgresJobSearchService {
  searchService ??= new PostgresJobSearchService(getPrisma());
  return searchService;
}
