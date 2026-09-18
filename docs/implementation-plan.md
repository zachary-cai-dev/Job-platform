# Implementation Plan

Repository is currently empty — this is a from-scratch build. Order is chosen so that
the hardest-to-get-right, most testable-in-isolation logic (geography, normalization,
dedup) is built and proven correct *before* anything depends on it, and so there is a
working end-to-end pipeline (one source, no frontend) before breadth (more sources) or
polish (SEO, admin) begins.

## Phase 0 — Foundation

- Initialize git repository.
- pnpm workspaces + Turborepo monorepo skeleton matching `docs/architecture.md` §4.
- Strict TypeScript base config, ESLint, Prettier, shared across packages.
- `packages/config`: Zod-validated environment schema (`DATABASE_URL`, `REDIS_URL`,
  per-source config, etc.), loaded once, imported everywhere — no ad hoc `process.env`
  reads elsewhere.
- `packages/shared`: Pino logger factory (with the correlation-id fields from
  `docs/ingestion.md` §10 baked into the base logger context), centralized error
  classes.
- `docker/docker-compose.yml`: Redis (Postgres is Supabase-hosted, not run locally).
- CI skeleton: install, typecheck, lint, unit tests on every push.

**Exit criteria**: `docker compose up` gives a running empty Redis; `pnpm test`
runs (nothing to test yet, but the harness works).

## Phase 1 — Geography, Normalization, Deduplication (pure packages)

Built and tested in isolation, no database dependency, per `docs/geography.md` and
`docs/ingestion.md` §5/§7.

- `packages/geography`: country/region data, `normalizeLocation`,
  `evaluateEuropeanEligibility`, full test suite against every example table in
  `docs/geography.md` (this is the acceptance gate for the whole product's core
  promise — do not proceed past this phase until it's green).
- `packages/normalization`: title/seniority/role-category parsing, technology alias
  index + extraction, employment-type and salary parsing, with unit tests per brief §34.
- `packages/deduplication`: scoring + veto logic and the field-reconciliation policy
  from `docs/ingestion.md` §7, unit-tested against the brief's dedup test matrix using
  in-memory fixtures (no DB yet — DB-backed candidate generation is tested in Phase 4).

**Exit criteria**: three pure packages, each with a test suite that encodes every
example given in the product brief, all green.

## Phase 2 — Data layer

- `packages/db`: Prisma schema from `docs/data-model.md`, initial migration.
- Database is Supabase-hosted Postgres, not local Docker — Prisma's `directUrl`
  points at Supabase's direct (non-pooled) connection for migrations, `url` at its
  pooled (PgBouncer) connection for runtime queries.
- Seed scripts: `RoleCategory` rows (the brief's category list), `Technology` rows +
  aliases (the brief's technology list), `Source` rows for all named sources — the
  MVP-candidate ATS/aggregator sources as `DISABLED` (config not yet populated), the
  rest as `UNSUPPORTED` with a `config.note` documenting why.
- `pg_trgm` extension (needed by `packages/deduplication`'s candidate generation —
  enable it on the Supabase project, it's on Supabase's standard allowed list) and a
  trigger-maintained `tsvector` search column (needed by Phase 5; Postgres's
  `to_tsvector` is `STABLE` not `IMMUTABLE`, so it can't back a `GENERATED ALWAYS AS`
  column — a `BEFORE INSERT/UPDATE` trigger does the equivalent job).

**Exit criteria**: `prisma migrate deploy` + seed against the Supabase project gives a
queryable, empty-of-jobs but fully-structured database. (Verified against local
Docker Postgres before the move to Supabase — schema, seed, and the search trigger
all confirmed working end-to-end; only the connection target changes.)

## Phase 3 — Source adapters

- `packages/sources/src/shared`: HTTP client wrapper (retry, backoff, rate limit as
  adapter-supplied config).
- Adapters, in order: Greenhouse → Lever → Ashby → RemoteOK → (Workable or
  SmartRecruiters — final pick depends on which has cleaner public docs at build time).
- **Curate the initial company target list.** Greenhouse/Lever/Ashby/Workable/
  SmartRecruiters are multi-tenant platforms — there is no "all jobs" endpoint; each
  adapter needs a list of company board tokens/slugs to poll, stored in
  `Source.config.boardTokens`. This needs an explicit research task: identify ~50–100
  companies known to hire remote-EU tech talent and publish on each ATS, seeded as
  data (growable later, possibly via a "suggest a company" admin action — not built in
  MVP). This is called out because it's easy to underestimate: the adapter code being
  correct doesn't matter if it has no targets to poll.
- Fixture-based integration tests per adapter: captured real (anonymized/trimmed)
  API responses as fixtures, asserting the adapter maps them to `RawJobPayload`
  correctly, independent of live network calls.

**Exit criteria**: each adapter, run against its fixtures, produces correct
`RawJobPayload[]`; against a real (rate-limited, small) live call, produces plausible
data end-to-end manually verified once.

## Phase 4 — Worker ingestion pipeline

- `packages/jobs`: `IngestionOrchestrator` wiring RawJob upsert → normalization →
  geography evaluation → deduplication → enrichment → canonical Job, per
  `docs/ingestion.md` §1.
- `apps/worker`: BullMQ scheduler (repeatable jobs per enabled `Source`), Source Fetch
  Queue, Normalization Queue, liveness sweep job.
- Wire up for **Greenhouse only** first, run it end-to-end against 2–3 real company
  boards, inspect results manually (raw jobs, eligibility decisions, dedup decisions)
  before enabling the remaining four sources.
- Enable remaining sources one at a time, verifying `IngestionRun` stats look sane
  after each (fetched/eligible/rejected/created/updated/duplicate counts).

**Exit criteria**: all 5 MVP sources ingest on a schedule, unattended, into a
populated, deduplicated, Europe-filtered `Job` table, with one source's failure
(simulate by disabling network to it) not affecting the others.

## Phase 5 — Search & API

- `packages/search`: `JobSearchService` interface, Postgres-FTS-backed implementation
  (tsvector + indexed column filters per `docs/data-model.md` §6/§11).
- `apps/web` REST route handlers: `GET /api/jobs`, `GET /api/jobs/:id`,
  `GET /api/filters`, `GET /api/companies`, `GET /api/companies/:slug` — Zod-validated
  query params matching the URL shape in brief §23, cursor-or-page pagination.

**Exit criteria**: the query example from brief §23
(`?q=typescript&role=full-stack&region=EUROPE&country=GB&seniority=senior&technology=react,node&postedWithin=24h&sort=newest`)
returns correct, correctly-sorted, correctly-paginated results against real ingested
data.

## Phase 6 — Frontend MVP

- Homepage feed: job cards per brief §9, newest-first default, relative posted-time
  display, freshness filter chips (last hour/6h/24h/3d/7d).
- Filter sidebar (desktop) / drawer (mobile): role, region, country, seniority,
  technology, employment type, salary range, posted window, source — all reflected in
  URL query params (brief §26) so searches are bookmarkable/shareable.
- Job detail page (`/jobs/:slug-id`) per brief §27.
- TanStack Query for client-side data fetching/caching against the Phase 5 API.
- Visual direction: Linear/Vercel/Raycast-inspired, not a generic admin-panel look —
  Tailwind + shadcn/ui as the base, custom job-card and filter components.

**Exit criteria**: a user can land on the homepage, see fresh Europe-eligible jobs,
filter down (e.g. Senior Backend, Germany, React, posted last 24h), open a job detail
page, and reach the original `applyUrl`.

## Phase 7 — Admin / observability

- `apps/web/app/admin` (access-gated by real staff accounts — email/password,
  approval workflow, session cookies; see `AdminUser`/`AdminSession` in
  `packages/db/prisma/schema.prisma` and `apps/web/src/lib/auth`, superseding the
  earlier shared-secret/basic-auth MVP gate): per-source table per
  `docs/data-model.md` §9 / brief §31, plus staff user management (approve/disable).
- Structured log review is otherwise sufficient for MVP-scale metrics (brief §32) —
  no separate metrics stack (Prometheus/Grafana) unless volume later justifies it.

## Phase 8 — SEO

- Server-rendered metadata, canonical URLs, `sitemap.xml`, `robots.txt`,
  `JobPosting` structured data on job detail pages — omitted/`"expired"`-marked
  the moment a job's `isActive` flips false, never left presenting stale postings as
  open (brief §28).
- Static-shaped landing routes (`/remote-software-engineer-jobs`,
  `/remote-jobs-europe`, `/remote-jobs-germany`, etc.) implemented as parameterized
  Next.js routes over the same `/api/jobs` query shape, not separate hand-built pages.

## Phase 9 — Hardening

- Load-check ingestion against the full set of seeded company targets.
- Review adapter error handling under real rate-limit responses (429s) from each ATS.
- Confirm dedup precision/recall manually against a sample of real merged jobs.
- Production deployment target decision (see open questions below) and CI/CD wiring.

## Explicitly deferred (brief §29/§30 — data model reserved, not built)

User accounts, saved jobs, hidden jobs, saved searches, job alerts — the `Job`/query
shape is designed in Phase 5/6 so these are additive later (see
`docs/data-model.md` §10).

## Testing strategy summary

| Layer | Approach |
|---|---|
| `packages/geography` | Table-driven unit tests, every brief example + edge cases (§geography.md §6) |
| `packages/normalization` | Unit tests: titles, seniority, technologies, employment types |
| `packages/deduplication` | Unit tests against brief §34's exact matrix, in-memory fixtures |
| `packages/sources/*` | Fixture-based integration tests per adapter (captured real responses) |
| `apps/worker` pipeline | Integration test: seeded fixtures → full pipeline → assert resulting `Job`/`JobSourceListing` rows, against a real (test-container) Postgres |
| `apps/web` API | Integration tests against the query contract (brief §23 example) |
| `apps/web` frontend | Playwright for golden-path flows: land → filter → view job → apply-link present |

## Open questions for review before implementation starts

1. **Company target list**: who curates the initial ~50–100 company board tokens per
   ATS source (Phase 3)? This is manual research work, not something an adapter can
   infer.
2. **Deployment target**: no production hosting choice has been made (Fly.io / Render /
   AWS ECS / other) — affects `docker/` specifics in Phase 9 but not the architecture.
3. ~~**Admin access control**~~ — resolved: real staff accounts (email/password,
   admin-approval workflow, session cookies) replace the shared-secret MVP gate.
4. **Workable vs. SmartRecruiters** as the 5th MVP source — either works structurally;
   picking one is a Phase 3 detail, default is whichever has the cleaner public docs
   when that phase starts, unless you have a preference now.
5. **RemoteOK / third-party feed terms**: confirm current API terms allow the intended
   use (commercial aggregation with outbound apply links) before relying on it in
   production — legitimate at time of writing, but terms can change.

Please review `docs/architecture.md`, `docs/data-model.md`, `docs/geography.md`, and
`docs/ingestion.md` alongside this plan. I'll wait for go-ahead (and answers to the
open questions above where relevant) before starting Phase 0.
