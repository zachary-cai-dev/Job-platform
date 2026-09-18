import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client against `DATABASE_URL` (Supabase's transaction-mode
 * PgBouncer pool). Fine for simple, single-statement reads (apps/web's query
 * paths). In dev, Next.js/tsx hot-reload can otherwise create a new client (and a
 * new connection pool) on every reload — cached on `globalThis` to avoid
 * exhausting Postgres connections.
 */
export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/**
 * A client pointed at a specific datasource URL — use this (with `DIRECT_URL`,
 * Supabase's session-mode pooler) for anything that runs a multi-statement
 * `$transaction`, like `packages/jobs`' write paths. PgBouncer's *transaction*-mode
 * pooling (the default `prisma` export above) can reassign a client's underlying
 * server connection between statements, which breaks Prisma's interactive
 * transactions outright (`P2028: Transaction not found`) — this was hit for real
 * during worker development, not a hypothetical. Session-mode pooling keeps one
 * server connection for the session's lifetime, which interactive transactions need.
 */
export function createPrismaClient(datasourceUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl });
}

export * from "@prisma/client";
