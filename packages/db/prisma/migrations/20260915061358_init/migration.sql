-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('ATS', 'JOB_BOARD', 'AGGREGATOR', 'CAREERS_PAGE');

-- CreateEnum
CREATE TYPE "IntegrationMethod" AS ENUM ('OFFICIAL_API', 'PUBLIC_API', 'RSS_FEED', 'ATS_ENDPOINT', 'STRUCTURED_FEED', 'PERMITTED_CRAWL');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ENABLED', 'DISABLED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "TechnologyCategory" AS ENUM ('LANGUAGE', 'FRAMEWORK', 'CLOUD', 'DATABASE', 'AI_ML', 'TOOLING', 'OTHER');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('INTERNSHIP', 'JUNIOR', 'MID', 'SENIOR', 'STAFF', 'PRINCIPAL', 'LEAD', 'MANAGER', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'FREELANCE', 'PART_TIME', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "RemoteType" AS ENUM ('FULLY_REMOTE', 'HYBRID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RegionCode" AS ENUM ('EUROPE', 'EU', 'EEA', 'EMEA', 'WORLDWIDE');

-- CreateEnum
CREATE TYPE "GeographyConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'NORMALIZED', 'EUROPE_ELIGIBLE', 'REJECTED_GEOGRAPHY', 'MERGED_DUPLICATE', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "sources" (
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "integrationMethod" "IntegrationMethod" NOT NULL,
    "status" "SourceStatus" NOT NULL DEFAULT 'DISABLED',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "role_categories" (
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_categories_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "technologies" (
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "category" "TechnologyCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technologies_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "raw_jobs" (
    "id" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "rawLocation" TEXT,
    "rawTitle" TEXT,
    "checksum" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "ingestionRunId" TEXT,
    "jobSourceListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "roleCategorySlug" TEXT NOT NULL,
    "seniority" "Seniority",
    "tags" TEXT[],
    "companyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionText" TEXT NOT NULL,
    "locationRaw" TEXT,
    "locationDisplay" TEXT NOT NULL,
    "remoteType" "RemoteType" NOT NULL DEFAULT 'FULLY_REMOTE',
    "eligibleCountries" TEXT[],
    "eligibleRegions" "RegionCode"[],
    "locationRestrictions" TEXT,
    "geographyConfidence" "GeographyConfidence" NOT NULL,
    "geographyReason" TEXT NOT NULL,
    "employmentType" "EmploymentType",
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "salaryPeriod" "SalaryPeriod",
    "skills" TEXT[],
    "postedAt" TIMESTAMP(3),
    "postedAtIsInferred" BOOLEAN NOT NULL DEFAULT false,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "applyUrl" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_technologies" (
    "jobId" TEXT NOT NULL,
    "technologySlug" TEXT NOT NULL,

    CONSTRAINT "job_technologies_pkey" PRIMARY KEY ("jobId","technologySlug")
);

-- CreateTable
CREATE TABLE "job_source_listings" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "postedAtIsInferred" BOOLEAN NOT NULL DEFAULT false,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_source_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "sourceSlug" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "europeEligibleCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedGeographyCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorSample" JSONB,
    "durationMs" INTEGER,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_jobs_sourceSlug_processingStatus_idx" ON "raw_jobs"("sourceSlug", "processingStatus");

-- CreateIndex
CREATE INDEX "raw_jobs_fetchedAt_idx" ON "raw_jobs"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "raw_jobs_sourceSlug_externalId_checksum_key" ON "raw_jobs"("sourceSlug", "externalId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_fingerprint_key" ON "jobs"("fingerprint");

-- CreateIndex
CREATE INDEX "jobs_isActive_postedAt_idx" ON "jobs"("isActive", "postedAt");

-- CreateIndex
CREATE INDEX "jobs_roleCategorySlug_idx" ON "jobs"("roleCategorySlug");

-- CreateIndex
CREATE INDEX "jobs_seniority_idx" ON "jobs"("seniority");

-- CreateIndex
CREATE INDEX "jobs_salaryMin_salaryMax_idx" ON "jobs"("salaryMin", "salaryMax");

-- CreateIndex
CREATE INDEX "jobs_geographyConfidence_idx" ON "jobs"("geographyConfidence");

-- CreateIndex
CREATE INDEX "jobs_eligibleRegions_idx" ON "jobs" USING GIN ("eligibleRegions");

-- CreateIndex
CREATE INDEX "jobs_eligibleCountries_idx" ON "jobs" USING GIN ("eligibleCountries");

-- CreateIndex
CREATE INDEX "job_source_listings_jobId_idx" ON "job_source_listings"("jobId");

-- CreateIndex
CREATE INDEX "job_source_listings_lastSeenAt_idx" ON "job_source_listings"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_source_listings_sourceSlug_externalId_key" ON "job_source_listings"("sourceSlug", "externalId");

-- CreateIndex
CREATE INDEX "ingestion_runs_sourceSlug_startedAt_idx" ON "ingestion_runs"("sourceSlug", "startedAt");

-- AddForeignKey
ALTER TABLE "raw_jobs" ADD CONSTRAINT "raw_jobs_sourceSlug_fkey" FOREIGN KEY ("sourceSlug") REFERENCES "sources"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_jobs" ADD CONSTRAINT "raw_jobs_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "ingestion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_jobs" ADD CONSTRAINT "raw_jobs_jobSourceListingId_fkey" FOREIGN KEY ("jobSourceListingId") REFERENCES "job_source_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_roleCategorySlug_fkey" FOREIGN KEY ("roleCategorySlug") REFERENCES "role_categories"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_technologies" ADD CONSTRAINT "job_technologies_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_technologies" ADD CONSTRAINT "job_technologies_technologySlug_fkey" FOREIGN KEY ("technologySlug") REFERENCES "technologies"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_source_listings" ADD CONSTRAINT "job_source_listings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_source_listings" ADD CONSTRAINT "job_source_listings_sourceSlug_fkey" FOREIGN KEY ("sourceSlug") REFERENCES "sources"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_sourceSlug_fkey" FOREIGN KEY ("sourceSlug") REFERENCES "sources"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
