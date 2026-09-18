import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { AshbyJob, AshbyJobBoardResponse } from "./types.js";
import { asNumber, toEmploymentType, toRemoteType, toSalaryPeriod } from "../shared/fieldMapping.js";

export interface AshbyCompanyConfig {
  /** The Ashby job board organization slug. */
  organizationSlug: string;
  /** Human-readable company name — not present in Ashby's job payload. */
  companyName: string;
}

export interface AshbyAdapterConfig {
  companies: AshbyCompanyConfig[];
  http?: HttpClientConfig;
}

function mapAshbyJob(job: AshbyJob, companyName: string): RawJobPayload {
  return {
    externalId: job.id,
    sourceUrl: job.jobUrl,
    applyUrl: job.applyUrl ?? job.jobUrl,
    rawTitle: job.title,
    rawLocation: job.location,
    remoteType: job.isRemote ? "FULLY_REMOTE" : toRemoteType(job.workplaceType),
    employmentType: toEmploymentType(job.employmentType),
    salaryMin: asNumber(job.compensation?.minValue),
    salaryMax: asNumber(job.compensation?.maxValue),
    salaryCurrency: job.compensation?.currency,
    salaryPeriod: toSalaryPeriod(job.compensation?.interval),
    companyName,
    description: job.descriptionHtml ?? "",
    postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
    rawPayload: job,
  };
}

export function createAshbyAdapter(config: AshbyAdapterConfig): JobSourceAdapter {
  return {
    source: "ashby",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const company of config.companies) {
        const data = await fetchJson<AshbyJobBoardResponse>(
          `https://api.ashbyhq.com/posting-api/job-board/${company.organizationSlug}`,
          config.http,
        );
        jobs.push(...data.jobs.map((job) => mapAshbyJob(job, company.companyName)));
      }
      return { jobs };
    },
  };
}
