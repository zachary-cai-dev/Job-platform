import type { FilterFacets, JobDetailItem, JobListResult, NewJobsCount } from "./types.js";
import type { JobsTab } from "./urlFilters.js";

export async function fetchJobs(queryString: string): Promise<JobListResult> {
  const res = await fetch(`/api/jobs${queryString ? `?${queryString}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`);
  return res.json() as Promise<JobListResult>;
}

export async function fetchFilterFacets(): Promise<FilterFacets> {
  const res = await fetch("/api/filters");
  if (!res.ok) throw new Error(`Failed to load filters (${res.status})`);
  return res.json() as Promise<FilterFacets>;
}

export async function fetchJobDetail(id: string): Promise<JobDetailItem> {
  const res = await fetch(`/api/jobs/${id}`);
  if (!res.ok) throw new Error(`Failed to load job (${res.status})`);
  return res.json() as Promise<JobDetailItem>;
}

export async function fetchNewJobsCount(since: string, tab: JobsTab): Promise<NewJobsCount> {
  const res = await fetch(`/api/jobs/new-count?since=${encodeURIComponent(since)}&tab=${encodeURIComponent(tab)}`);
  if (!res.ok) throw new Error(`Failed to load new-jobs count (${res.status})`);
  return res.json() as Promise<NewJobsCount>;
}
