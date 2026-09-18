import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { JobicyJob, JobicyResponse } from "./types.js";

export interface JobicyAdapterConfig {
  /** Jobicy's own geo filter, e.g. "europe" — narrows the fetch server-side. */
  geo?: string;
  /** Jobicy's own industry filter, e.g. "dev". */
  industry?: string;
  count?: number;
  http?: HttpClientConfig;
}

function buildDescription(job: JobicyJob): string {
  const lines: string[] = [];
  if (job.jobType.length) lines.push(`Employment type: ${job.jobType.join(", ")}`);
  if (job.jobLevel) lines.push(`Level: ${job.jobLevel}`);
  lines.push(job.jobDescription || job.jobExcerpt || "");
  return lines.join("\n\n");
}

function mapJobicyJob(job: JobicyJob): RawJobPayload {
  return {
    externalId: String(job.id),
    sourceUrl: job.url,
    applyUrl: job.url,
    rawTitle: job.jobTitle,
    rawLocation: job.jobGeo,
    companyName: job.companyName,
    description: buildDescription(job),
    postedAt: job.pubDate ? new Date(job.pubDate) : undefined,
    rawPayload: job,
  };
}

/**
 * Jobicy's terms (its "friendlyNotice" field, returned in every response) ask for
 * credit + a direct link to Jobicy, and for application buttons to point at the
 * feed's own `url` — already satisfied since `sourceUrl`/`applyUrl` are `job.url`.
 * Filtering by `geo=europe&industry=dev` server-side (rather than fetching
 * everything and filtering downstream) keeps this adapter's fetch small and on-topic.
 */
export function createJobicyAdapter(config: JobicyAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "jobicy",
    async fetchJobs(): Promise<FetchJobsResult> {
      const url = new URL("https://jobicy.com/api/v2/remote-jobs");
      url.searchParams.set("count", String(config.count ?? 50));
      if (config.geo) url.searchParams.set("geo", config.geo);
      if (config.industry) url.searchParams.set("industry", config.industry);

      const data = await fetchJson<JobicyResponse>(url.toString(), config.http);
      return { jobs: data.jobs.map(mapJobicyJob) };
    },
  };
}
