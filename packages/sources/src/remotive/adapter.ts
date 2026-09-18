import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { RemotiveJob, RemotiveResponse } from "./types.js";

export interface RemotiveAdapterConfig {
  /** Restricts the fetch to one Remotive category slug (e.g. "software-dev"); omit for all categories. */
  category?: string;
  http?: HttpClientConfig;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  freelance: "Freelance",
  internship: "Internship",
};

/**
 * Remotive gives job type and salary as separate structured fields, but our
 * downstream normalization (packages/normalization) only ever infers these from
 * free text. Folding them into the description as plain sentences — rather than
 * threading new structured fields through the whole pipeline — lets the existing
 * text-based extractors pick them up, same as every other adapter's description.
 */
function buildDescription(job: RemotiveJob): string {
  const lines: string[] = [];
  if (job.salary) lines.push(`Salary: ${job.salary}`);
  const jobType = JOB_TYPE_LABELS[job.job_type] ?? job.job_type;
  if (jobType) lines.push(`Employment type: ${jobType}`);
  lines.push(job.description);
  return lines.join("\n\n");
}

function mapRemotiveJob(job: RemotiveJob): RawJobPayload {
  return {
    externalId: String(job.id),
    sourceUrl: job.url,
    applyUrl: job.url,
    rawTitle: job.title,
    rawLocation: job.candidate_required_location,
    companyName: job.company_name.trim(),
    description: buildDescription(job),
    postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
    rawPayload: job,
  };
}

/**
 * Remotive's published terms (embedded in every response under the "0-legal-notice"
 * key) require crediting Remotive and linking back to the job's Remotive URL —
 * already satisfied since `sourceUrl`/`applyUrl` are `job.url`, Remotive's own page.
 * Remotive also explicitly asks for no more than ~4 requests/day; this adapter does
 * one request per run, so it's the *scheduler's* job to poll infrequently — see
 * `Source.config.pollIntervalMs` for the "remotive" row in packages/db/prisma/seed.ts.
 */
export function createRemotiveAdapter(config: RemotiveAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "remotive",
    async fetchJobs(): Promise<FetchJobsResult> {
      const url = config.category
        ? `https://remotive.com/api/remote-jobs?category=${encodeURIComponent(config.category)}`
        : "https://remotive.com/api/remote-jobs";
      const data = await fetchJson<RemotiveResponse>(url, config.http);
      return { jobs: data.jobs.map(mapRemotiveJob) };
    },
  };
}
