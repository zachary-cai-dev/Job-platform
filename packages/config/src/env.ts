import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Validates environment variables once, at startup, with a clear error message
 * listing every problem — never a scattered `process.env.X!` throughout the
 * codebase (docs/architecture.md §5, docs/implementation-plan.md Phase 0). Takes
 * an explicit source (defaulting to `process.env`) so it's a pure, testable
 * function rather than a hidden global read.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

let cachedEnv: AppEnv | undefined;

/** Cached singleton for call sites that don't need to inject a custom source. */
export function getEnv(): AppEnv {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}
