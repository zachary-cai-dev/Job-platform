import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { LandingJobsJob, LandingJobsResponse } from "./types.js";

export interface LandingJobsAdapterConfig {
  http?: HttpClientConfig;
}

/**
 * Landing.jobs' public feed carries no company-name field at all — every job's
 * `url` instead follows `/at/<company-slug>/<job-slug>`, so the company slug is the
 * only identifier available. Title-casing it ("ki-performance" -> "Ki Performance")
 * is an approximation, not a real display name; acceptable at MVP scale, called out
 * here as a known limitation rather than silently guessed.
 */
function companyNameFromUrl(url: string): string {
  const match = /\/at\/([^/]+)\//.exec(url);
  if (!match?.[1]) return "Unknown";
  return match[1]
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildLocation(job: LandingJobsJob): string {
  if (job.locations?.length) {
    return job.locations.map((loc) => [loc.city, loc.country_code].filter(Boolean).join(", ")).join(" / ");
  }
  return job.remote ? "Remote" : "Unspecified";
}

function buildDescription(job: LandingJobsJob): string {
  return [job.role_description, job.main_requirements, job.nice_to_have, job.perks].filter(Boolean).join("\n\n");
}

function mapLandingJobsJob(job: LandingJobsJob): RawJobPayload {
  return {
    externalId: String(job.id),
    sourceUrl: job.url,
    applyUrl: job.url,
    rawTitle: job.title,
    rawLocation: buildLocation(job),
    companyName: companyNameFromUrl(job.url),
    description: buildDescription(job),
    postedAt: job.published_at ? new Date(job.published_at) : new Date(job.created_at),
    rawPayload: job,
  };
}

/** Landing.jobs is a Portugal-centric (and wider European) tech job board. */
export function createLandingJobsAdapter(config: LandingJobsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "landingjobs",
    async fetchJobs(): Promise<FetchJobsResult> {
      const data = await fetchJson<LandingJobsResponse>("https://landing.jobs/api/v1/jobs", config.http);
      return { jobs: data.map(mapLandingJobsJob) };
    },
  };
}
