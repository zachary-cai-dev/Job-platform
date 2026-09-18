# Ingestion Pipeline

## 1. Pipeline stages

```
Scheduler (BullMQ repeatable, per source)
   → Source Fetch Queue (per-source concurrency + rate limit)
      → Source Adapter (packages/sources/*)
         → RawJob upsert (Postgres, append-only on content change)
            → Normalization Queue
               → title/seniority/role/tech/employment-type/salary normalization
               → Europe Eligibility Evaluation (packages/geography)
                  ├─ REJECTED_GEOGRAPHY → stop, counted, no Job created
                  └─ eligible → Deduplication Service
                                   ├─ match found → merge into existing Job
                                   └─ no match    → create new Job
                     → Enrichment (logo, salary normalization, tags)
                        → Job (canonical, searchable)
   → Liveness Sweep (per source, end of each fetch cycle)
      → listings not re-seen this cycle → isActive = false
      → Job with zero active listings → isActive = false
```

All of this runs in `apps/worker`. Nothing here executes inside a web request.

## 2. Source adapter contract

```ts
// packages/sources/src/types.ts

interface FetchJobsOptions {
  since?: Date;        // incremental-fetch hint; adapter uses it if the source supports it
  cursor?: string;      // resume token from a previous capped run
  signal?: AbortSignal;
}

interface RawJobPayload {
  externalId: string;
  sourceUrl: string;
  applyUrl: string;
  rawTitle: string;
  rawLocation?: string;
  companyName: string;
  companyUrl?: string;
  remoteType?: "FULLY_REMOTE" | "HYBRID" | "UNKNOWN";
  employmentType?: "PERMANENT" | "CONTRACT" | "FREELANCE" | "PART_TIME" | "INTERNSHIP";
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY";
  description: string;
  postedAt?: Date;       // only if the source actually provides it
  rawPayload: unknown;    // the full, untouched parsed response for this job
}

interface FetchJobsResult {
  jobs: RawJobPayload[];
  nextCursor?: string;    // present only if the source has more pages than this run fetched
}

interface JobSourceAdapter {
  source: string;          // matches Source.slug in the DB
  fetchJobs(options?: FetchJobsOptions): Promise<FetchJobsResult>;
}
```

Rules that keep adapters isolated (brief §7):

- An adapter never imports `packages/db` or `packages/jobs`. It returns plain data;
  `apps/worker`'s ingestion orchestrator (`packages/jobs`) is the only thing that
  persists.
- An adapter owns its own HTTP calls, pagination, source-specific mapping, retries, and
  rate limiting internally, using a shared helper (`packages/sources/src/shared/http.ts`)
  that wraps `fetch` with retry + exponential backoff + a per-adapter rate limiter — but
  the *policy values* (max retries, backoff base, requests/sec) are adapter-supplied
  config, not hardcoded in the shared helper.
- An adapter throwing or timing out fails only its own `IngestionRun`; the scheduler
  queue processes each source's fetch job independently, so Greenhouse failing never
  blocks Lever, Ashby, or RemoteOK (brief §20).
- `rawPayload` is stored completely untouched — adapters must not pre-filter or
  pre-transform fields out of it, since that's exactly the data future normalization
  fixes and debugging rely on.

## 3. Initial sources (MVP)

Architecture-first, per brief §8/§9 — these five are implemented once the pipeline
above works end-to-end; adding a sixth afterward should mean writing one adapter file
and a `Source` row, nothing else:

| Source | Integration method | Notes |
|---|---|---|
| Greenhouse | Public job board API (`boards-api.greenhouse.io`) | multi-tenant, per-company board token, well-documented, no auth needed for public boards |
| Lever | Public postings API (`api.lever.co/v0/postings/:company`) | same shape, per-company slug |
| Ashby | Public job board API (`api.ashbyhq.com/posting-api/job-board/:org`) | JSON, stable |
| RemoteOK | Public JSON feed (`remoteok.com/api`) | aggregator, already remote-only, needs its own location parsing since it's not an ATS |
| Workable or SmartRecruiters | Public job board API/widget feed | per-company slug/account, same ATS pattern as Greenhouse/Lever |
| Teamtailor | Public `jobs.rss` feed | paginated with `per_page` + `offset` |
| Personio | Public careers XML feed | per-company account and language |
| Recruitee | Public offers XML feed | anonymous feed; not the authenticated Careers API |
| Pinpoint | Public `postings.json` feed | per-company subdomain |
| Company career pages | Configured sitemap/direct URLs + `JobPosting` JSON-LD | same-origin sitemap filtering; no general crawler |

Workday and BambooHR remain `UNSUPPORTED`: their documented recruiting/applicant
tracking APIs require tenant credentials. No anonymous, undocumented endpoints are
reverse engineered. Other sources without a permitted public integration path retain
an `UNSUPPORTED` row and an explicit reason rather than a half-working scraper.

Wellfound uses robots-permitted, server-rendered role/location pages for bounded
discovery and schema.org `JobPosting` JSON-LD for details. It never visits disallowed
search, application, profile, or authenticated routes and stops on 401/403/429.

LinkedIn is the sole direct-HTML exception: its adapter reads anonymous public search
and detail pages conservatively, never authenticates or bypasses controls, and stops
the collection immediately on an auth wall, CAPTCHA/challenge, 401/403, or 429.

## 4. Scheduler & queues (BullMQ)

- **Product startup**: the root `pnpm dev` and `pnpm start` commands launch the web
  app and worker together. When the worker starts, every enabled source is enqueued
  immediately and then continues on its configured recurring interval; source-specific
  `jobs:*` commands are diagnostic conveniences, not required for normal operation.
- **Scheduler**: one BullMQ repeatable job per enabled `Source` row, interval
  configurable per source (typically 10–20 minutes for ATS APIs, since job postings
  don't churn faster than that). Enqueues a `fetch-source` job with `{ sourceSlug }`.
- **Source Fetch Queue**: consumes `fetch-source` jobs. Per-source concurrency and rate
  limiting via BullMQ's `limiter: { max, duration }` on a per-source worker group (or a
  dedicated queue per source if limits diverge significantly). On completion: upserts
  `RawJob` rows, writes/updates the `IngestionRun` row, enqueues a
  `normalize-run` job (or one `normalize-raw-job` job per new/changed `RawJob`, batched)
  onto the Normalization Queue.
- **Normalization Queue**: consumes raw jobs still `PENDING`, runs
  normalization → geography evaluation → dedup → enrichment (§5–§8) synchronously
  within the job handler (these are pure/CPU-light operations plus a few DB
  round-trips, not worth their own queues at MVP scale), and updates
  `RawJob.processingStatus` accordingly.
- **Retries**: BullMQ's built-in `attempts` + `backoff: { type: 'exponential', delay }`
  per queue; adapter-level HTTP retries (§2) are a separate, inner retry loop for
  transient network errors, distinct from the queue-level retry for job-handler
  failures.
- **Dead letters**: jobs exceeding `attempts` land in BullMQ's failed set; a scheduled
  sweep records them into `IngestionRun.errorSample` and increments `errorCount` so
  they surface in the admin view without needing a separate alerting system at MVP
  stage.

## 5. Normalization (`packages/normalization`)

Pure, dictionary-driven, no I/O — mirrors `packages/geography`'s design so it's fully
unit-testable.

### 5.1 Title & seniority

1. Clean the raw title (strip decorative punctuation, trademark symbols) without
   discarding the original — `title` always keeps the source's exact string.
2. Match against a **seniority keyword dictionary** (`Sr.`/`Senior` → `SENIOR`,
   `Jr.`/`Junior` → `JUNIOR`, `Staff` → `STAFF`, `Principal` → `PRINCIPAL`, `Lead` →
   `LEAD`, `Intern`/`Internship` → `INTERNSHIP`, `Manager` → `MANAGER`, `Director` →
   `DIRECTOR`; absence of any keyword → `seniority = null`, never guessed).
3. Match against an **ordered role-category keyword dictionary** (`packages/
   normalization/src/data/roleCategories.ts`) — ordered because compound titles need a
   priority (e.g. "AI Backend Engineer" should primarily be `BACKEND_ENGINEER` with an
   `ai` tag, not accidentally classified as a generic AI role, or vice versa depending
   on the ordering the team chooses — the list is reviewable, data-driven config, not
   buried conditional logic).
4. Construct `normalizedTitle` deterministically from `{Seniority canonical prefix}
   {RoleCategory canonical label}` (e.g. `SENIOR` + `FULL_STACK_ENGINEER` →
   "Senior Full Stack Engineer") rather than rewriting the source string in place —
   this keeps normalization idempotent and testable as a pure function of
   `(seniority, roleCategory)`.
5. `tags`: kebab-case slugs for the matched category plus any secondary keyword hits
   (e.g. "AI Platform" in the title contributes an `ai` tag even when the primary
   category is `FULL_STACK_ENGINEER`).

Worked example from the brief:
`"Sr. Fullstack Software Developer - AI Platform"` →
`normalizedTitle: "Senior Full Stack Software Engineer"`,
`roleCategory: FULL_STACK_ENGINEER`, `seniority: SENIOR`,
`tags: [full-stack, software-engineering, ai]`. The original `title` string is shown
in the UI unchanged (brief §17).

### 5.2 Technology extraction

- `packages/normalization` builds a reverse alias→canonical-slug index at startup from
  the `Technology` table (`"Node"`, `"NodeJS"`, `"Node.js"` → `NODE_JS`, displayed as
  `"Node.js"`).
- Scans `title` + `descriptionText` (+ any source-provided explicit tags/skills field)
  with word-boundary matching.
- Short/ambiguous aliases (`Go`, `R`, `C`) are matched only in tech-list-shaped context
  (comma/pipe/bullet-separated "stack" sections, or immediately after words like
  "stack:"/"technologies:"), not anywhere in prose — to avoid `Go` matching inside
  "Google" or ordinary sentences. Long, unambiguous aliases (`Kubernetes`, `PostgreSQL`,
  `TypeScript`) match anywhere.
- Output is written as `JobTechnology` rows (canonical, filterable). Freeform
  requirement-bullet tokens that don't match the dictionary are conservatively captured
  into `skills` (lower confidence, not used for primary filtering) rather than dropped.

### 5.3 Employment type & salary

- Employment type: keyword dictionary over title/description/source-structured field
  (`contract`/`contractor` → `CONTRACT`, `freelance` → `FREELANCE`, `part-time` →
  `PART_TIME`, `internship` → `INTERNSHIP`, default `PERMANENT` only when a source
  explicitly marks full-time/permanent — otherwise left `null`, never guessed).
- Salary: regex family over common patterns (`€90k - €110k`, `$120,000–$150,000/year`,
  `£500/day`, `PLN 15 000 – 20 000 / mies.`), extracting `min`, `max`, currency (from
  symbol or ISO code), and period (`year`/`month`/`day`/`hour` keywords). Ambiguous or
  unparseable strings leave `salaryMin/Max/Currency/Period` all `null` rather than
  guessing — a missing salary is far less harmful than a wrong one.

## 5.4 Role category gate (non-tech role rejection)

Confirmed necessary against real data during implementation: a company's ATS board
lists every open req — Sales, Legal, Support, Marketing, Payroll — not just
engineering ones. Running the real Greenhouse/Ashby adapters against GitLab/Discord/
Linear/Vercel's actual boards showed the majority of postings are non-tech; without a
gate they'd all land in the feed tagged `roleCategory: OTHER`.

Immediately after title normalization (§5.1), before the pricier geography
evaluation: if `roleCategory === "OTHER"` (the title matched none of
`packages/normalization`'s `ROLE_CATEGORIES`), the `RawJob` is marked
`REJECTED_ROLE_CATEGORY` and the pipeline stops — no `Job` is created, matching the
brief's product scope (§1: this is a tech-roles product, not a generic job board).
Tracked as its own `IngestionRun.rejectedRoleCategoryCount`, parallel to
`rejectedGeographyCount`, for the same admin-visibility reason.

## 6. Europe eligibility evaluation

Delegates entirely to `packages/geography`'s `evaluateEuropeanEligibility` (see
`docs/geography.md`), called with `{ structuredLocations, locationRaw, title,
descriptionText }` pulled from the normalized `RawJob`. The result populates
`eligibleCountries`, `eligibleRegions`, `geographyConfidence`, `geographyReason`
directly on the (soon to be created/updated) `Job`. A `REJECTED_GEOGRAPHY` result stops
the pipeline for that `RawJob` — it is never turned into a `Job`, but the `RawJob` row
and the rejection reason remain queryable for debugging and for the admin "rejected by
location" count.

## 7. Deduplication (`packages/deduplication`)

### 7.1 Candidate generation (before scoring)

Scoring against the whole `Job` table doesn't scale and isn't necessary — candidates
are narrowed first via cheap indexed lookups, in order:

1. **Exact apply-URL match** (URL normalized: lowercased host, tracking/query params
   stripped) against any existing active `JobSourceListing.applyUrl` → treat as a
   certain match, skip scoring entirely (equivalent to score = 100).
2. **Same source + externalId already known** (`JobSourceListing` unique constraint) →
   this isn't a dedup decision at all, it's just "this listing was seen again" —
   update `lastSeenAt`.
3. Otherwise, query candidates by normalized `companySlug` match **and**
   `normalizedTitle` trigram similarity (Postgres `pg_trgm`, `similarity() > 0.4`)
   within a recent window (`firstDiscoveredAt` in the last ~45 days — open positions
   don't live forever). This typically returns 0–5 candidate `Job` rows to score.

### 7.2 Hard vetoes (checked before scoring)

Some brief test cases (§34) require a candidate to be **disqualified outright**, not
merely scored low, because high company+title similarity alone would otherwise clear
the merge threshold even when the postings are clearly different reqs:

- **Incompatible narrow locations**: both the candidate and the new listing name a
  specific, non-overlapping single country or small country set (e.g. existing job is
  `eligibleCountries: [DE]` only, new listing is `eligibleCountries: [ES]` only, with
  `geographyConfidence: HIGH` on both) → veto, do not merge. Overlapping or broad
  regions (`EUROPE`, `EMEA`, `WORLDWIDE`) never veto — only genuinely disjoint narrow
  restrictions do.

### 7.3 Scoring (configurable, `packages/deduplication/src/config.ts`)

| Signal | Points |
|---|---|
| Company exact match (normalized name/domain) | +40 |
| Normalized title match (exact, or trigram similarity ≥ 0.85) | +30 |
| Same apply URL (normalized) | +100 (short-circuits, see §7.1) |
| Description similarity (trigram/shingle similarity ≥ threshold) | +25 |
| Location compatibility (overlapping `eligibleCountries`/`eligibleRegions`) | +10 |

**Merge threshold: score ≥ 70.** The scoring function and threshold are isolated behind
a small `DeduplicationService` interface precisely so a stronger signal (e.g. embedding
cosine similarity on the description) can be added as one more weighted input later
without touching the candidate-generation or merge/veto plumbing.

### 7.4 Merge behavior — field reconciliation policy

When a match is found, the pipeline does **not** blindly overwrite the canonical `Job`
with the new listing's data. Explicit reconciliation rules:

- `postedAt` = the **earliest** non-null `postedAt` across all listings (the true
  original posting date, per brief §10's freshness integrity requirement).
- `description`/`descriptionText` = kept if already present and non-trivially shorter
  than the incoming one only when the incoming is clearly richer (length heuristic);
  otherwise kept as-is — first-write-wins for description to avoid churn, with a TODO
  documented (not built) for manual admin override if ever needed.
- `salaryMin/Max/Currency/Period` = filled in if the canonical `Job` is missing them
  and the new listing has them; never overwritten once set (avoids one source's vaguer
  data clobbering another's precise figure).
- `companyLogoUrl` = filled in if missing.
- `lastSeenAt` = always bumped to now.
- A new `JobSourceListing` row is created (or its `lastSeenAt` bumped if it already
  existed) — the canonical `Job` always keeps every listing that fed it.

### 7.5 Test matrix (mirrors brief §34, implemented as `packages/deduplication` unit tests)

| Case | Expected |
|---|---|
| Same job posted on Greenhouse and re-discovered via LinkedIn-sourced listing (same company, same/near-identical title, compatible location) | merge into one `Job`, two `JobSourceListing`s |
| Same title, different company | no merge (company signal fails) |
| Same company, different role | no merge (title signal fails) |
| Same title/company, materially different (narrow, disjoint) locations | no merge — vetoed by §7.2 |

## 8. Enrichment

Runs after a `Job` is created or merged: company logo resolution (source-provided logo
URL first, otherwise a public logo-lookup service, otherwise omitted — never scraped),
final tag assembly, and `locationDisplay` string construction (e.g.
`eligibleRegions: [EU]` → `"Remote (EU)"`; `eligibleCountries: [DE, FR]` with no
region → `"Remote (Germany, France)"`).

## 9. Liveness / freshness integrity

At the end of each source's fetch cycle (once `IngestionRun` reaches `SUCCESS`), any
`JobSourceListing` for that source not touched (`lastSeenAt` still older than
`IngestionRun.startedAt`) is set `isActive = false`. A `Job` whose every
`JobSourceListing` is inactive is itself set `isActive = false`. This is a separate,
explicit step (not inferred implicitly) so a partially-failed fetch cycle
(`IngestionRunStatus.PARTIAL`) never wrongly deactivates listings just because that run
happened to fetch fewer pages than usual.

`postedAt` vs `firstDiscoveredAt` vs `lastSeenAt` vs `updatedAt` are tracked
separately end-to-end through this pipeline exactly as specified in brief §10 — no
stage is allowed to collapse them into one field.

## 10. Observability hooks

Every stage logs structured JSON (Pino) carrying `ingestionRunId`, `sourceSlug`,
`externalJobId`, and `canonicalJobId` (once assigned) so a single job's path through
fetch → normalize → geography → dedup → enrich can be reconstructed from logs alone.
Counters listed in `docs/architecture.md` §8 are incremented at the exact pipeline
boundary they name (e.g. `jobs_location_rejected` increments only at the geography
stage's reject branch), and are persisted per-run on `IngestionRun` for the admin view.
