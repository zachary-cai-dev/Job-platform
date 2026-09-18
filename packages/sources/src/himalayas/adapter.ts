import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsOptions, FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { HimalayasJob, HimalayasResponse } from "./types.js";

export interface HimalayasAdapterConfig {
  /**
   * Himalayas' public feed has no server-side category/location filter and lists
   * every remote job on the platform (100k+), sorted newest-first — most of it not
   * tech. Rather than pull the whole catalog, this caps how many newest-first pages
   * a single run will walk before giving up; the (mostly non-tech) jobs it does
   * fetch still go through the normal geography + role-category pipeline downstream,
   * same as every other aggregator adapter. Defaults to 15 pages (~300 jobs/run —
   * see `DEFAULT_PAGE_SIZE`'s doc comment for why "page" is smaller than it looks).
   */
  maxPages?: number;
  pageSize?: number;
  http?: HttpClientConfig;
}

/**
 * Requested via `?limit=`, but verified live: Himalayas silently caps the actual
 * page size at 20 regardless of what's requested (`?limit=100` and `?limit=50` both
 * come back with exactly 20 jobs). Kept at 100 here as the honest ask — if Himalayas
 * ever lifts the cap this adapter benefits for free — but `maxPages` is tuned
 * assuming the real per-page yield is 20, not 100.
 */
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 15;

function buildDescription(job: HimalayasJob): string {
  const lines: string[] = [];
  if (job.employmentType) lines.push(`Employment type: ${job.employmentType}`);
  if (job.minSalary || job.maxSalary) {
    const range = [job.minSalary, job.maxSalary].filter((v) => v != null).join("–");
    lines.push(`Salary: ${job.currency ?? ""} ${range} ${job.salaryPeriod ?? ""}`.replace(/\s+/g, " ").trim());
  }
  if (job.seniority?.length) lines.push(`Seniority: ${job.seniority.join(", ")}`);
  lines.push(job.description);
  return lines.join("\n\n");
}

function mapHimalayasJob(job: HimalayasJob): RawJobPayload {
  const rawLocation = job.locationRestrictions?.length ? job.locationRestrictions.join(", ") : "Worldwide";
  return {
    externalId: job.guid,
    sourceUrl: job.guid,
    applyUrl: job.applicationLink ?? job.guid,
    rawTitle: job.title,
    rawLocation,
    companyName: job.companyName,
    description: buildDescription(job),
    postedAt: job.pubDate ? new Date(job.pubDate * 1000) : undefined,
    rawPayload: job,
  };
}

export function createHimalayasAdapter(config: HimalayasAdapterConfig = {}): JobSourceAdapter {
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;

  return {
    source: "himalayas",
    async fetchJobs(options?: FetchJobsOptions): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < maxPages; page++) {
        const url = new URL("https://himalayas.app/jobs/api");
        url.searchParams.set("limit", String(pageSize));
        if (cursor) url.searchParams.set("cursor", cursor);

        const data = await fetchJson<HimalayasResponse>(url.toString(), config.http);
        if (data.jobs.length === 0) break;

        for (const job of data.jobs) {
          if (options?.since && job.pubDate * 1000 < options.since.getTime()) {
            return { jobs };
          }
          jobs.push(mapHimalayasJob(job));
        }

        if (!data.nextCursor) break;
        cursor = data.nextCursor;
      }

      return { jobs };
    },
  };
}
