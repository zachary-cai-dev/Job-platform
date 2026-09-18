import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { WorkingNomadsJob, WorkingNomadsResponse } from "./types.js";

export interface WorkingNomadsAdapterConfig {
  http?: HttpClientConfig;
}

function buildDescription(job: WorkingNomadsJob): string {
  const lines = [job.description];
  if (job.tags) lines.push(`Tags: ${job.tags}`);
  return lines.join("\n\n");
}

function mapWorkingNomadsJob(job: WorkingNomadsJob): RawJobPayload {
  return {
    externalId: job.url,
    sourceUrl: job.url,
    applyUrl: job.url,
    rawTitle: job.title,
    rawLocation: job.location,
    companyName: job.company_name,
    description: buildDescription(job),
    postedAt: job.pub_date ? new Date(job.pub_date) : undefined,
    rawPayload: job,
  };
}

/**
 * Working Nomads' `/api/exposed_jobs/` endpoint returns its whole current listing
 * (no pagination) — a general remote-jobs board across all fields, not tech-only, so
 * the usual geography + REJECTED_ROLE_CATEGORY pipeline does the real filtering.
 */
export function createWorkingNomadsAdapter(config: WorkingNomadsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "workingnomads",
    async fetchJobs(): Promise<FetchJobsResult> {
      const data = await fetchJson<WorkingNomadsResponse>(
        "https://www.workingnomads.com/api/exposed_jobs/",
        config.http,
      );
      return { jobs: data.map(mapWorkingNomadsJob) };
    },
  };
}
