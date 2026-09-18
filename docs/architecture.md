# Architecture — European Remote Tech Jobs Platform

## 1. Product summary

Aggregate freshly posted remote technology jobs that candidates **physically located in
Europe** are eligible to apply for, from a growing set of independently pluggable sources.
Freshness, accurate geographic eligibility, and strong deduplication are the three
differentiators — not raw volume.

This is not a generic worldwide remote-job board with a Europe filter bolted on.
Geography is a first-class domain concept with its own package, its own confidence
model, and its own test suite.

## 2. Repository status

The repository is currently empty (no git history, no existing code). Everything below
is a proposal for review — nothing has been implemented yet.

## 3. High-level system

```
                 ┌────────────────────────────────────────────────────┐
                 │                     Scheduler                       │
                 │            (BullMQ repeatable jobs, per source)     │
                 └───────────────────────┬──────────────────────────┘
                                          │ enqueue
                                          ▼
                 ┌────────────────────────────────────────────────────┐
                 │              Source Fetch Queue (BullMQ)            │
                 │   concurrency + rate limit configured per source    │
                 └───────────────────────┬──────────────────────────┘
                                          ▼
        ┌──────────────────────────────────────────────────────────────┐
        │                    Source Adapters (packages/sources)         │
        │   greenhouse · lever · ashby · remoteok · workable · ...      │
        │   each owns: HTTP calls, pagination, parsing, retries          │
        └───────────────────────────┬────────────────────────────────┘
                                     ▼  writes
                          ┌────────────────────┐
                          │   RawJob (Postgres)  │  ← immutable source capture
                          └──────────┬─────────┘
                                     ▼ enqueue
                 ┌────────────────────────────────────────────────────┐
                 │              Normalization Queue (BullMQ)            │
                 │  title/seniority/role/tech extraction, location      │
                 │  parsing via packages/geography + packages/normalization│
                 └───────────────────────┬──────────────────────────┘
                                          ▼
                 ┌────────────────────────────────────────────────────┐
                 │         Europe Eligibility Evaluation                │
                 │   packages/geography → INCLUDE / EXCLUDE + confidence│
                 └───────────────────────┬──────────────────────────┘
                                  EXCLUDE │ INCLUDE
                                          ▼
                 ┌────────────────────────────────────────────────────┐
                 │              Deduplication Service                   │
                 │   packages/deduplication → match existing Job or     │
                 │   create new canonical Job + JobSourceListing         │
                 └───────────────────────┬──────────────────────────┘
                                          ▼
                 ┌────────────────────────────────────────────────────┐
                 │                   Enrichment                         │
                 │   company logo, salary normalization, skill tags     │
                 └───────────────────────┬──────────────────────────┘
                                          ▼
                          ┌────────────────────┐
                          │   Job (Postgres)     │  ← canonical, searchable
                          └──────────┬─────────┘
                                     ▼
                 ┌────────────────────────────────────────────────────┐
                 │        Search API (apps/web /api/jobs, Postgres FTS) │
                 └───────────────────────┬──────────────────────────┘
                                          ▼
                 ┌────────────────────────────────────────────────────┐
                 │              Next.js Frontend (apps/web)             │
                 └────────────────────────────────────────────────────┘
```

Crawling/parsing never happens inside a user-facing HTTP request. All ingestion is
background-worker driven (BullMQ + Redis), so a slow or failing source cannot degrade
the web app.

## 4. Monorepo structure

```
apps/
  web/                      # Next.js app: UI, API routes, SEO pages
  worker/                   # BullMQ worker process(es): scheduler, fetch, normalize,
                             # dedupe, enrich — runs the ingestion pipeline

packages/
  db/                       # Prisma schema, migrations, generated client, seed scripts
  geography/                # Country/region data + eligibility engine (pure, no I/O)
  normalization/            # Title/seniority/role/employment-type normalization
  deduplication/            # Fingerprinting + scoring-based dedup service
  sources/                  # One subfolder per source adapter, common interface
    src/
      greenhouse/
      lever/
      ashby/
      remoteok/
      workable/
      smartrecruiters/
      shared/                # shared HTTP client, adapter base helpers
  jobs/                      # Domain/application services: JobService,
                              # IngestionService, orchestrates geography +
                              # normalization + dedup + db, used by worker & web
  search/                    # Search abstraction (Postgres FTS now, swappable later)
  shared/                    # Cross-cutting: logger (pino), config loader, error types,
                              # zod schemas shared between web/worker
  config/                    # Centralized env validation (zod), per-environment config

docker/
  docker-compose.yml         # postgres, redis, adminer (optional), worker, web
  Dockerfile.web
  Dockerfile.worker

docs/
  architecture.md
  data-model.md
  geography.md
  ingestion.md
  implementation-plan.md
```

Package boundaries matter more than folder depth:

- `packages/geography` and `packages/normalization` are **pure** (no DB, no network) —
  this is what makes them exhaustively unit-testable and reusable from both the worker
  and, later, a one-off script or admin tool.
- `packages/sources/*` never imports `packages/db` directly — adapters return `RawJob`-shaped
  plain objects; only `packages/jobs` (the orchestration layer) persists them. This is
  what keeps "adding a source" from ever touching the central pipeline.
- `apps/worker` depends on `packages/jobs`, `packages/sources`, `packages/geography`,
  `packages/normalization`, `packages/deduplication`, `packages/db`.
- `apps/web` depends on `packages/jobs` (read paths), `packages/search`, `packages/db`,
  `packages/geography` (for filter option metadata), but never on `packages/sources`.

## 5. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | shared across the whole monorepo |
| Frontend | Next.js (App Router) + React + Tailwind + shadcn/ui + TanStack Query | SSR for SEO pages, CSR for interactive filtering |
| Backend API | Next.js Route Handlers (REST) | no separate API server for MVP — avoids premature service split |
| Worker runtime | Node.js + BullMQ | separate `apps/worker` process(es), same codebase/monorepo |
| Database | PostgreSQL (Supabase-hosted) + Prisma | single source of truth; full-text search included; Supabase's pooled (PgBouncer) connection at runtime, direct connection for migrations |
| Queue/cache | Redis (BullMQ backend) | also used for rate-limit counters, short-lived caches |
| Validation | Zod | request validation, env validation, adapter payload guards |
| Testing | Vitest (unit/integration), Playwright (E2E for web) | fixture-based adapter tests |
| Logging | Pino, structured JSON | correlation ids: `ingestionRunId`, `source`, `externalJobId`, `canonicalJobId` |
| Local infra | Docker Compose | redis only — Postgres is Supabase-hosted, not run locally |
| Package/monorepo tool | pnpm workspaces + Turborepo | simple, fast, no need for Nx-level complexity at this size |

No microservices, no Kubernetes, no Elasticsearch for MVP — see §9.

### 5.1 Two Prisma clients: pooled vs. session

Confirmed the hard way during `apps/worker` development, not a hypothetical: Prisma's
multi-statement `$transaction` (used by every create/merge write in
`packages/jobs`) breaks outright against Supabase's **transaction-mode** PgBouncer
pool (`DATABASE_URL`) — `P2028: Transaction not found`, because transaction-mode
pooling can hand different statements within one logical transaction to different
underlying server connections. `packages/db` exports two ways to get a client:

- `prisma` — the cached singleton against `DATABASE_URL` (transaction-mode pool).
  Fine for simple, single-statement reads.
- `createPrismaClient(url)` — a client against an explicit URL. `apps/worker` uses
  this with `DIRECT_URL` (Supabase's **session**-mode pool) specifically because its
  writes are transactional.

Anything doing multi-statement writes must use the session-mode connection.

## 6. API layer

REST endpoints served from `apps/web` (Next.js route handlers), backed by
`packages/jobs` (read/query) and `packages/search`:

- `GET /api/jobs` — filtered, paginated, sorted job feed
- `GET /api/jobs/:id` — single canonical job + its source listings
- `GET /api/filters` — available filter facets (roles, regions, countries, technologies,
  seniorities, sources) with counts where practical
- `GET /api/companies`, `GET /api/companies/:slug`

All inputs validated with Zod at the boundary; response shapes are stable, versioned by
convention (breaking changes get a new field, not a silent shape change). Full contract
in `docs/data-model.md` §API contracts (to be expanded when the API is implemented).

## 7. Search

MVP uses PostgreSQL: a `tsvector` column over `title + normalizedTitle + skills +
description`, kept in sync by a `BEFORE INSERT/UPDATE` trigger (`to_tsvector` is
STABLE, not IMMUTABLE, so it can't back a `GENERATED ALWAYS AS` column directly),
combined with plain indexed-column filters (region, country, seniority, salary,
postedAt, source). Company name lives on a separate table and is filtered/joined
separately from this vector. This is wrapped behind
`packages/search`'s `JobSearchService` interface so the Postgres implementation can be
swapped for Typesense/Meilisearch/OpenSearch later without touching `apps/web` or
`packages/jobs`. No Elasticsearch for MVP — unjustified operational overhead at this
scale (target: tens of thousands of active jobs, not millions).

## 8. Admin & observability

A lightweight internal admin view (`apps/web/app/admin`, access-gated) shows, per
source: status, last attempted/successful sync, fetched/eligible/rejected/new/updated/
duplicate counts, errors, duration — sourced from an `IngestionRun` /
`SourceIngestionStat` table written by the worker at the end of each run (see
`docs/data-model.md`).

Metrics tracked (structured log fields today; Prometheus-compatible counters/histograms
when needed): `source_fetch_count`, `source_fetch_failure_count`, `raw_jobs_received`,
`jobs_normalized`, `jobs_europe_eligible`, `jobs_location_rejected`,
`jobs_deduplicated`, `jobs_created`, `jobs_updated`, `source_latency`,
`normalization_failures`. Every ingestion log line carries `ingestionRunId`, `source`,
`externalJobId`, and `canonicalJobId` (once known) for traceability end to end.

## 9. Explicit non-goals for MVP

- No microservices — one deployable web app, one deployable worker, sharing packages.
- No Kubernetes — Docker Compose locally; a single container platform (e.g. Fly.io,
  Render, ECS) in production is sufficient at this scale.
- No Elasticsearch/vector DB — Postgres FTS behind an interface that allows a later swap.
- No CAPTCHA bypass, anti-bot evasion, auth bypass, or proxy rotation for evasion —
  sources without a legitimate public/official integration path ship as a documented,
  disabled adapter stub, not a scraper workaround.
- No user accounts/auth for MVP — the data model reserves the shape (see
  `docs/data-model.md` §Future: accounts & alerts) but nothing is built until requested.

## 10. Why this shape

- **Adapters are isolated** so a broken or ToS-restricted source never touches core
  logic and can be disabled independently (§7 of the brief).
- **RawJob is immutable and kept** so normalization/geography bugs are fixable by
  replaying, not re-crawling.
- **Job vs. JobSourceListing** models the real-world fact that one position is
  frequently posted to several places — the UI shows one job, the system keeps every
  source.
- **Geography and normalization are pure packages** so they can be unit-tested
  exhaustively against the large example table in the brief without spinning up a
  database.
- **Everything is swappable at a seam**: search backend, individual sources, and
  deduplication scoring can all change without a rewrite.
