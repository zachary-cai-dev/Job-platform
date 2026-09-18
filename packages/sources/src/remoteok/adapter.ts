import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import { isRemoteOkJob, type RemoteOkJob, type RemoteOkResponse } from "./types.js";

export interface RemoteOkAdapterConfig {
  http?: HttpClientConfig;
}

function mapRemoteOkJob(job: RemoteOkJob): RawJobPayload {
  return {
    externalId: job.id,
    sourceUrl: job.url,
    // RemoteOK's public feed does not expose the employer's original application
    // URL separately from its own listing page; `url` is the best available link
    // until/unless a richer field is confirmed available.
    applyUrl: job.url,
    rawTitle: job.position,
    rawLocation: job.location,
    companyName: job.company,
    description: job.description ?? "",
    postedAt: job.date ? new Date(job.date) : undefined,
    rawPayload: job,
  };
}

/**
 * RemoteOK is an aggregator, not an ATS — every job is already "remote" by
 * construction, but eligibility for Europe specifically still needs the full
 * geography evaluation, since RemoteOK's own `location` field is free text
 * ("Worldwide", "Europe", a specific country, etc.) with no structured region data.
 */
export function createRemoteOkAdapter(config: RemoteOkAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "remoteok",
    async fetchJobs(): Promise<FetchJobsResult> {
      const data = await fetchJson<RemoteOkResponse>("https://remoteok.com/api", config.http);
      const jobs = data.filter(isRemoteOkJob).map(mapRemoteOkJob);
      return { jobs };
    },
  };
}
