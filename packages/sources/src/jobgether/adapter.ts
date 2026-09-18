import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { JobgetherJob, JobgetherResponse } from "./types.js";

export interface JobgetherAdapterConfig {
  /** Jobgether's own `locations` filter — country/continent/city slugs, e.g. "europe". A coarse server-side pre-filter; the real geography call is still made downstream. */
  locations?: string[];
  maxPages?: number;
  http?: HttpClientConfig;
}

const PAGE_LIMIT = 25;
const DEFAULT_MAX_PAGES = 5;

/** No free-text description in the search response (this is a search/list endpoint, not a per-job detail one — see the adapter's own doc comment) — synthesize one from the structured fields. */
function buildDescription(job: JobgetherJob): string {
  const lines: string[] = [];
  if (job.contractType) lines.push(`Employment type: ${job.contractType}`);
  if (job.experience) lines.push(`Experience level: ${job.experience}`);
  if (job.remote) lines.push(`Remote: ${job.remote}`);
  if (job.salaryRange) lines.push(`Salary: ${job.salaryRange}`);
  if (job.jobFunctions.length) lines.push(`Job function${job.jobFunctions.length > 1 ? "s" : ""}: ${job.jobFunctions.join(", ")}`);
  return lines.join("\n");
}

function mapJobgetherJob(job: JobgetherJob): RawJobPayload {
  return {
    externalId: job.id,
    sourceUrl: job.url,
    applyUrl: job.url,
    rawTitle: job.title,
    rawLocation: job.location,
    companyName: job.company,
    description: buildDescription(job),
    postedAt: job.postedAt ? new Date(job.postedAt) : undefined,
    rawPayload: job,
  };
}

/**
 * Jobgether publishes a small JSON API explicitly built for AI-agent consumption
 * (`/astroapi/ai/jobs/docs` describes it as "Intended for AI agents/assistants
 * answering user job-search queries"), explicitly allowlisted in robots.txt
 * (`Allow: /astroapi/ai/jobs.json`) — a real, documented, versioned contract, not a
 * reverse-engineered internal endpoint. This adapter uses the current stable
 * `/api/v1/jobs` path (the `/astroapi/ai/jobs` alias the robots.txt entry names is
 * documented as deprecated, sunsetting 2026-09-28). `url` is Jobgether's own listing
 * page per the docs — there's no separate external apply link in this response.
 */
export function createJobgetherAdapter(config: JobgetherAdapterConfig = {}): JobSourceAdapter {
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;

  return {
    source: "jobgether",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];

      for (let page = 1; page <= maxPages; page++) {
        const url = new URL("https://jobgether.com/api/v1/jobs");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(PAGE_LIMIT));
        url.searchParams.set("sort", "date");
        if (config.locations?.length) url.searchParams.set("locations", config.locations.join(","));

        const data = await fetchJson<JobgetherResponse>(url.toString(), config.http);
        jobs.push(...data.jobs.map(mapJobgetherJob));

        if (!data.pagination.hasMore) break;
      }

      return { jobs };
    },
  };
}
