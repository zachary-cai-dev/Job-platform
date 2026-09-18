/**
 * Manual one-shot runner: `pnpm run-once <sourceSlug>` (or all ENABLED sources
 * if no slug given). Runs a real fetch → ingest cycle directly, without BullMQ/Redis
 * — useful for demos and for verifying an adapter/config against the live DB.
 */
import { getEnv } from "@euro-jobs/config";
import { createLogger } from "@euro-jobs/shared";
import { getWorkerPrismaClient } from "./db.js";
import { processFetchSourceJob } from "./processors/fetchSource.js";

async function main() {
  const env = getEnv();
  const logger = createLogger("worker:run-once", env.LOG_LEVEL);
  const prisma = getWorkerPrismaClient(env);

  try {
    const requestedSlug = process.argv.slice(2).find((argument) => argument !== "--");
    const sources = requestedSlug
      ? await prisma.source.findMany({ where: { slug: requestedSlug } })
      : await prisma.source.findMany({ where: { status: "ENABLED" } });

    if (sources.length === 0) {
      logger.warn({ requestedSlug }, "no matching sources to run");
      return;
    }

    for (const source of sources) {
      logger.info({ sourceSlug: source.slug }, "running fetch cycle");
      await processFetchSourceJob(source.slug, { prisma, logger });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("run-once failed", error);
  process.exitCode = 1;
});
