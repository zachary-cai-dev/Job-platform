import type { AppEnv } from "@euro-jobs/config";
import { createPrismaClient, type PrismaClient } from "@euro-jobs/db";

/**
 * The worker's writes go through multi-statement `$transaction` calls
 * (packages/jobs' create/merge paths) — those need Supabase's session-mode pooler
 * (`DIRECT_URL`), not the transaction-mode one (`DATABASE_URL`), which can reassign
 * connections mid-transaction and breaks Prisma's interactive transactions
 * (see packages/db/src/index.ts's `createPrismaClient` doc comment).
 */
export function getWorkerPrismaClient(env: AppEnv): PrismaClient {
  if (!env.DIRECT_URL) {
    throw new Error(
      "DIRECT_URL is required for apps/worker (session-mode pooler — transaction-mode " +
        "DATABASE_URL breaks multi-statement writes). Set it in packages/db/.env.",
    );
  }
  return createPrismaClient(env.DIRECT_URL);
}
