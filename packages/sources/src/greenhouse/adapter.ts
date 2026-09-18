import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { GreenhouseJob, GreenhouseJobsResponse } from "./types.js";

export interface GreenhouseCompanyConfig {
  /** The Greenhouse job board token, e.g. "stripe". */
  boardToken: string;
  /** Human-readable company name — not present anywhere in Greenhouse's job payload. */
  companyName: string;
}

export interface GreenhouseAdapterConfig {
  companies: GreenhouseCompanyConfig[];
  http?: HttpClientConfig;
}

function mapGreenhouseJob(job: GreenhouseJob, companyName: string): RawJobPayload {
  return {
    externalId: String(job.id),
    sourceUrl: job.absolute_url,
    applyUrl: job.absolute_url,
    rawTitle: job.title,
    rawLocation: job.location?.name ?? job.offices?.[0]?.name,
    remoteType: /remote/i.test(job.location?.name ?? job.offices?.[0]?.name ?? "") ? "FULLY_REMOTE" : "UNKNOWN",
    companyName,
    description: job.content ?? "",
    // Greenhouse's public boards API does not expose a distinct "originally posted"
    // timestamp — `updated_at` is the closest available signal. Listings are rarely
    // edited post-publish in practice, but this is a best-effort proxy, not a
    // guaranteed original posting date; downstream normalization still tracks
    // firstDiscoveredAt/lastSeenAt independently regardless (docs/ingestion.md §9).
    postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
    rawPayload: job,
  };
}

export function createGreenhouseAdapter(config: GreenhouseAdapterConfig): JobSourceAdapter {
  return {
    source: "greenhouse",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const company of config.companies) {
        const data = await fetchJson<GreenhouseJobsResponse>(
          `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}/jobs?content=true`,
          config.http,
        );
        jobs.push(...data.jobs.map((job) => mapGreenhouseJob(job, company.companyName)));
      }
      return { jobs };
    },
  };
}
