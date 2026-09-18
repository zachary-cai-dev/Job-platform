import type { PrismaClient } from "@euro-jobs/db";
import type { Logger } from "@euro-jobs/shared";
import type { Queue } from "bullmq";

/**
 * Default polling cadence for sources with no explicit `pollIntervalMs` override.
 * Sources with published rate-limit requests or an unusually expensive fetch
 * (Remotive, Himalayas, No Fluff Jobs — see their `Source.config` in
 * packages/db/prisma/seed.ts) set their own slower interval via
 * `resolvePollIntervalMs` below and are unaffected by this default.
 */
const FETCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Reads a per-source override out of `Source.config.pollIntervalMs`, falling back to
 * `FETCH_INTERVAL_MS`. Exists because not every source is comfortable being polled
 * every 15 minutes — Remotive's published terms explicitly ask for at most ~4
 * requests/day, and other sources (e.g. `nofluffjobs`, whose single request returns
 * its entire catalog) are better polled less aggressively out of courtesy even
 * without an explicit request. `Source.config` is a free-form `Json?` column, so
 * this needs no schema migration — just a documented convention per source.
 */
function resolvePollIntervalMs(config: unknown): number {
  if (config && typeof config === "object" && "pollIntervalMs" in config) {
    const value = (config as { pollIntervalMs?: unknown }).pollIntervalMs;
    if (typeof value === "number" && value > 0) return value;
  }
  return FETCH_INTERVAL_MS;
}

/**
 * Registers one BullMQ repeatable job per currently-`ENABLED` `Source` row.
 *
 * BullMQ's repeatable-job key encodes the `every` value itself (not just the
 * `jobId`) — re-adding the same `jobId` with a *different* `every` registers a
 * second, independent repeatable job rather than replacing the first one, so a
 * naive "just call `queue.add` again on restart" approach silently double-polls
 * every source whenever `FETCH_INTERVAL_MS` or a `pollIntervalMs` override
 * changes. To keep this function actually idempotent, it clears every existing
 * repeatable job on this queue first, then rebuilds the full schedule from
 * scratch — the DB's `Source` rows are the single source of truth for what
 * should be scheduled, so a clean rebuild on every worker start/restart is both
 * simpler and safer than trying to diff against the old schedule.
 */
export async function scheduleEnabledSources(
  prisma: PrismaClient,
  queue: Queue,
  logger: Logger,
): Promise<void> {
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }
  if (existing.length > 0) {
    logger.info({ count: existing.length }, "cleared stale repeatable schedules before rebuilding");
  }

  const sources = await prisma.source.findMany({ where: { status: "ENABLED" } });

  for (const source of sources) {
    const everyMs = resolvePollIntervalMs(source.config);
    await queue.add(
      source.slug,
      { sourceSlug: source.slug },
      {
        // A product start should populate/refresh jobs immediately; subsequent
        // executions retain the source's normal polling cadence. BullMQ keeps
        // this as part of the repeatable schedule, so there is no separate
        // one-shot startup path that could drift from scheduler behavior.
        repeat: { every: everyMs, immediately: true },
        jobId: `schedule:${source.slug}`,
      },
    );
    logger.info({ sourceSlug: source.slug, everyMs }, "scheduled immediate and recurring fetch");
  }

  if (sources.length === 0) {
    logger.warn("no ENABLED sources found — nothing scheduled");
  }
}
