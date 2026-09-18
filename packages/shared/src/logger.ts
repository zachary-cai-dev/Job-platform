import pino, { type Logger } from "pino";

export type { Logger };

export interface IngestionLogContext {
  ingestionRunId?: string;
  source?: string;
  externalJobId?: string;
  canonicalJobId?: string;
}

/**
 * Structured JSON logger (docs/architecture.md §8). One per process/service name —
 * `apps/worker` and `apps/web` each create their own root logger and derive child
 * loggers with request/ingestion context from it, rather than constructing pino
 * directly at call sites.
 */
export function createLogger(name: string, level = "info"): Logger {
  return pino({
    name,
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/**
 * Attaches the correlation ids every ingestion log line should carry
 * (docs/ingestion.md §10) so a job's path through fetch → normalize → geography →
 * dedup → enrich can be reconstructed from logs alone.
 */
export function withIngestionContext(logger: Logger, context: IngestionLogContext): Logger {
  return logger.child(context);
}
