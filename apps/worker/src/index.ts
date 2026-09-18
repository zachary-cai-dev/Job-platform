import { getEnv } from "@euro-jobs/config";
import { createLogger } from "@euro-jobs/shared";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { getWorkerPrismaClient } from "./db.js";
import { processFetchSourceJob } from "./processors/fetchSource.js";
import { createSourceFetchQueue, SOURCE_FETCH_QUEUE_NAME } from "./queues.js";
import { scheduleEnabledSources } from "./scheduler.js";

const CONCURRENCY = 3;

async function main() {
  const env = getEnv();
  const logger = createLogger("worker", env.LOG_LEVEL);
  const prisma = getWorkerPrismaClient(env);

  // BullMQ requires this on the connection for its blocking commands.
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const queue = createSourceFetchQueue(connection);
  await scheduleEnabledSources(prisma, queue, logger);

  const worker = new Worker(
    SOURCE_FETCH_QUEUE_NAME,
    async (job) => {
      const { sourceSlug } = job.data as { sourceSlug: string };
      await processFetchSourceJob(sourceSlug, { prisma, logger });
    },
    { connection, concurrency: CONCURRENCY },
  );

  worker.on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id, sourceSlug: job?.data?.sourceSlug }, "source fetch job failed");
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, sourceSlug: job.data?.sourceSlug }, "source fetch job completed");
  });

  logger.info({ concurrency: CONCURRENCY }, "worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down worker");
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    connection.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("worker failed to start", error);
  process.exit(1);
});
