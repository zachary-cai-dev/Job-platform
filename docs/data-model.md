# Data Model — PostgreSQL / Prisma

## 1. Design principles

- **RawJob is append-only and immutable.** It captures exactly what a source returned,
  before any interpretation. Normalization bugs get fixed by *replaying* RawJob rows,
  never by re-crawling.
- **Job is canonical; JobSourceListing is provenance.** One real position, many places
  it was found. The UI renders `Job`; the admin/debug views render `JobSourceListing`.
- **Extensible vocabularies are tables, not enums.** The brief explicitly requires that
  new job categories be addable easily, and that the technology dictionary support
  aliases. Postgres enums require a migration (`ALTER TYPE`) to extend; reference
  tables (`RoleCategory`, `Technology`, `Source`) take a plain insert. Only genuinely
  fixed, small vocabularies (seniority ladder, employment type, region codes,
  confidence level) are modeled as native Prisma/Postgres enums.
- **Never discard source truth during normalization** — original `title`,
  `description`, and `locationRaw` are always kept alongside their normalized
  counterparts.

## 2. Entity overview

```
Source 1───* RawJob            (raw capture, append-only)
Source 1───* JobSourceListing  (one row per source that has this job)
Company 1───* Job
RoleCategory 1───* Job
Technology *───* Job  (through JobTechnology)
Job 1───* JobSourceListing     (canonical job ← its listings)
IngestionRun 1───* RawJob      (which run fetched this raw row)
Source 1───* IngestionRun      (admin/observability history)
```

## 3. Reference (extensible vocabulary) tables

```prisma
enum SourceKind {
  ATS
  JOB_BOARD
  AGGREGATOR
  CAREERS_PAGE
}

enum IntegrationMethod {
  OFFICIAL_API
  PUBLIC_API
  RSS_FEED
  ATS_ENDPOINT
  STRUCTURED_FEED
  PERMITTED_CRAWL
}

enum SourceStatus {
  ENABLED
  DISABLED
  UNSUPPORTED   // adapter contract exists, documented as not integrable yet
}

model Source {
  slug              String            @id  // "greenhouse", "lever", "remoteok"
  displayName       String
  kind              SourceKind
  integrationMethod IntegrationMethod
  status            SourceStatus      @default(DISABLED)
  config            Json?             // adapter-specific: board tokens, base URLs, etc.
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  rawJobs           RawJob[]
  jobSourceListings JobSourceListing[]
  ingestionRuns     IngestionRun[]
}

model RoleCategory {
  slug        String   @id            // "FULL_STACK_ENGINEER"
  label       String                  // "Full Stack Engineer"
  description String?
  createdAt   DateTime @default(now())

  jobs        Job[]
}

enum TechnologyCategory {
  LANGUAGE
  FRAMEWORK
  CLOUD
  DATABASE
  AI_ML
  TOOLING
  OTHER
}

model Technology {
  slug        String              @id  // canonical id: "NODE_JS"
  displayName String                    // "Node.js" (what the UI shows)
  aliases     String[]                  // ["Node", "NodeJS", "node.js"]
  category    TechnologyCategory
  createdAt   DateTime            @default(now())

  jobs        JobTechnology[]
}
```

Adding a new job category or a new technology alias is a data seed/insert, never a
schema migration. `Source` doubles as the admin registry described in the brief §31 —
`status` and `config` are what the ingestion scheduler and admin UI read.

## 4. Fixed enums

```prisma
enum Seniority {
  INTERNSHIP
  JUNIOR
  MID
  SENIOR
  STAFF
  PRINCIPAL
  LEAD
  MANAGER
  DIRECTOR
}

enum EmploymentType {
  PERMANENT
  CONTRACT
  FREELANCE
  PART_TIME
  INTERNSHIP
}

enum RemoteType {
  FULLY_REMOTE
  HYBRID
  UNKNOWN
}

enum RegionCode {
  EUROPE
  EU
  EEA
  EMEA
  WORLDWIDE
}

enum GeographyConfidence {
  HIGH
  MEDIUM
  LOW
}

enum SalaryPeriod {
  HOURLY
  DAILY
  MONTHLY
  YEARLY
}

enum ProcessingStatus {
  PENDING
  NORMALIZED
  EUROPE_ELIGIBLE
  REJECTED_GEOGRAPHY
  MERGED_DUPLICATE
  PUBLISHED
  FAILED
}
```

`RegionCode` and `GeographyConfidence` mirror the types exported by
`packages/geography` exactly — the Prisma schema is generated to match that package's
types, not the other way around.

## 5. RawJob

```prisma
model RawJob {
  id                 String            @id @default(cuid())

  sourceSlug         String
  source             Source            @relation(fields: [sourceSlug], references: [slug])

  externalId         String                          // source's native job id
  sourceUrl          String
  rawPayload         Json                             // untouched API/feed response
  rawLocation        String?
  rawTitle           String?

  checksum           String                           // hash(rawPayload), detects unchanged re-fetch
  fetchedAt          DateTime          @default(now())

  processingStatus   ProcessingStatus  @default(PENDING)
  processingError    String?

  ingestionRunId     String?
  ingestionRun       IngestionRun?     @relation(fields: [ingestionRunId], references: [id])

  jobSourceListingId String?                          // set once normalized
  jobSourceListing   JobSourceListing? @relation(fields: [jobSourceListingId], references: [id])

  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  @@unique([sourceSlug, externalId, checksum])         // idempotent re-fetch; content change = new row
  @@index([sourceSlug, processingStatus])
  @@index([fetchedAt])
}
```

Content changes create a new `RawJob` row rather than overwriting — this preserves a
full history of how a source's payload evolved, which is what makes "inspect source
changes" and "replay normalization" (brief §14) actually possible.

## 6. Job (canonical)

```prisma
model Job {
  id                  String              @id @default(cuid())

  title               String                          // original, as shown in UI
  normalizedTitle     String
  roleCategorySlug    String
  roleCategory        RoleCategory        @relation(fields: [roleCategorySlug], references: [slug])
  seniority           Seniority?
  tags                String[]                        // ["full-stack", "ai"]

  companyId           String
  company             Company             @relation(fields: [companyId], references: [id])

  description         String                          // original, HTML/markdown as provided
  descriptionText      String                          // plain text (FTS + extraction input)

  locationRaw          String?
  locationDisplay        String                        // e.g. "Remote (EU)"
  remoteType             RemoteType          @default(FULLY_REMOTE)

  eligibleCountries       String[]                      // ISO 3166-1 alpha-2
  eligibleRegions          RegionCode[]
  locationRestrictions      String?                     // verbatim, e.g. "No US/Canada"

  geographyConfidence        GeographyConfidence
  geographyReason             String

  employmentType               EmploymentType?

  salaryMin                     Int?
  salaryMax                     Int?
  salaryCurrency                  String?               // ISO 4217
  salaryPeriod                     SalaryPeriod?

  skills                          String[]              // free-text, not dictionary-backed
  technologies                     JobTechnology[]       // canonical, dictionary-backed

  postedAt                          DateTime?
  postedAtIsInferred                  Boolean  @default(false)
  firstDiscoveredAt                    DateTime @default(now())
  lastSeenAt                            DateTime @default(now())
  expiresAt                              DateTime?

  applyUrl                                String
  fingerprint                              String   // indexed, not unique — see §11

  isActive                                  Boolean  @default(true)

  createdAt                                  DateTime @default(now())
  updatedAt                                    DateTime @updatedAt

  sourceListings                                JobSourceListing[]

  @@index([isActive, postedAt])
  @@index([roleCategorySlug])
  @@index([seniority])
  @@index([salaryMin, salaryMax])
  @@index([geographyConfidence])
  @@index([eligibleRegions], type: Gin)
  @@index([eligibleCountries], type: Gin)
}

model JobTechnology {
  jobId          String
  job            Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)
  technologySlug String
  technology     Technology @relation(fields: [technologySlug], references: [slug])

  @@id([jobId, technologySlug])
}
```

Full-text search: a generated `tsvector` column (`searchVector`) over
`title || normalizedTitle || companyName || descriptionText || skills`, added via a raw
SQL migration (Prisma models it as `Unsupported("tsvector")` with a GIN index) — see
`docs/architecture.md` §7 and `docs/implementation-plan.md` for the search package that
wraps it.

`postedAtIsInferred = true` whenever `postedAt` had to fall back to
`firstDiscoveredAt`, matching the brief's rule to never pretend the fallback is the
real posting date.

## 7. Company

```prisma
model Company {
  id         String   @id @default(cuid())
  slug       String   @unique
  name       String
  logoUrl    String?
  websiteUrl String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  jobs       Job[]
}
```

## 8. JobSourceListing

```prisma
model JobSourceListing {
  id                 String   @id @default(cuid())

  jobId              String
  job                Job      @relation(fields: [jobId], references: [id])

  sourceSlug         String
  source             Source   @relation(fields: [sourceSlug], references: [slug])

  externalId         String
  sourceUrl          String
  applyUrl           String

  postedAt           DateTime?
  postedAtIsInferred Boolean  @default(false)
  firstDiscoveredAt  DateTime @default(now())
  lastSeenAt         DateTime @default(now())
  isActive           Boolean  @default(true)

  rawJobs            RawJob[]

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([sourceSlug, externalId])
  @@index([jobId])
  @@index([lastSeenAt])
}
```

A listing becomes `isActive = false` when a fetch cycle completes for its source and
the listing wasn't seen (see `docs/ingestion.md` §Liveness). When every listing under a
`Job` is inactive, the `Job.isActive` is flipped false too — the canonical job
disappears from the feed without deleting history.

## 9. IngestionRun (admin & observability)

```prisma
enum IngestionRunStatus {
  RUNNING
  SUCCESS
  FAILED
  PARTIAL
}

model IngestionRun {
  id                     String             @id @default(cuid())

  sourceSlug             String
  source                 Source             @relation(fields: [sourceSlug], references: [slug])

  startedAt              DateTime           @default(now())
  finishedAt             DateTime?
  status                 IngestionRunStatus @default(RUNNING)

  fetchedCount            Int                @default(0)
  europeEligibleCount      Int                @default(0)
  rejectedGeographyCount    Int                @default(0)
  createdCount               Int                @default(0)
  updatedCount                 Int                @default(0)
  duplicateCount                 Int                @default(0)
  errorCount                       Int                @default(0)
  errorSample                        Json?           // small [{message, externalId}, ...] sample
  durationMs                           Int?

  rawJobs                                RawJob[]

  @@index([sourceSlug, startedAt])
}
```

This is exactly the row the admin view in brief §31 renders per source; no separate
metrics store is needed for MVP since Postgres already holds this cheaply and it's
naturally queryable ("last 24h error rate per source").

## 10. Future: accounts, saved jobs, alerts (not built for MVP)

Data shape reserved so this is additive later, not a redesign:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  createdAt     DateTime @default(now())

  savedJobs     SavedJob[]
  savedSearches SavedSearch[]
}

model SavedJob {
  userId    String
  jobId     String
  createdAt DateTime @default(now())
  @@id([userId, jobId])
}

model SavedSearch {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  name      String
  queryJson Json                // serialized filter state, mirrors /api/jobs query params
  alertsEnabled Boolean @default(false)
  createdAt DateTime @default(now())

  alertDeliveries AlertDelivery[]
}

model AlertDelivery {
  id            String   @id @default(cuid())
  savedSearchId String
  savedSearch   SavedSearch @relation(fields: [savedSearchId], references: [id])
  jobId         String
  sentAt        DateTime @default(now())
}
```

None of this is created in the MVP migration — it's documented here so the canonical
`Job`/filter-query shape is designed knowing it will need to be replayable into an
alert-matching engine later.

## 11. Notable indexing decisions

| Index | Why |
|---|---|
| `Job(isActive, postedAt)` | primary feed query: active jobs, newest first |
| `Job(eligibleRegions)` GIN, `Job(eligibleCountries)` GIN | region/country filters hit an array-contains query |
| `Job(salaryMin, salaryMax)` | salary range filters and salary sort |
| `Job.fingerprint` (plain index, not unique) | fast candidate-narrowing lookup for dedup — deliberately not a uniqueness constraint: two genuinely different, currently-open reqs can legitimately share company+title+location, and the real merge/no-merge decision belongs to `packages/deduplication`'s scoring engine, not a hash collision at the DB layer |
| `RawJob(sourceSlug, processingStatus)` | worker picks up `PENDING` rows per source efficiently |
| `JobSourceListing(sourceSlug, externalId)` unique | idempotent upsert per source+external id |
| `IngestionRun(sourceSlug, startedAt)` | admin view's per-source history query |
