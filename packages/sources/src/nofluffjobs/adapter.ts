import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { NoFluffJobsPosting, NoFluffJobsResponse } from "./types.js";

export interface NoFluffJobsAdapterConfig {
  http?: HttpClientConfig;
}

function buildLocation(posting: NoFluffJobsPosting): string {
  if (posting.fullyRemote) return "Fully remote";
  // Verified live: some postings' places carry no `country` at all (not just no
  // city), so this can't assume `place.country.name` is present.
  const places = posting.location.places
    .map((place) => [place.city, place.country?.name].filter(Boolean).join(", "))
    .filter(Boolean);
  return places.length ? places.join(" / ") : "Remote";
}

/**
 * No Fluff Jobs' listing endpoint (the only one this adapter uses — see the
 * function doc on `createNoFluffJobsAdapter`) carries no free-text job description,
 * only structured metadata. This synthesizes a short plain-text description from
 * that metadata so the normal downstream pipeline (technology/seniority extraction,
 * sanitization) still has real text to work with.
 */
function buildDescription(posting: NoFluffJobsPosting): string {
  const lines: string[] = [];
  if (posting.category) lines.push(`Category: ${posting.category}`);
  if (posting.technology) lines.push(`Primary technology: ${posting.technology}`);
  if (posting.seniority?.length) lines.push(`Seniority: ${posting.seniority.join(", ")}`);
  const requirements = posting.tiles?.values.filter((t) => t.type === "requirement").map((t) => t.value);
  if (requirements?.length) lines.push(`Requirements: ${requirements.join(", ")}`);
  if (posting.salary?.from || posting.salary?.to) {
    const { from, to, currency, period } = posting.salary;
    lines.push(`Salary: ${currency ?? ""} ${from ?? ""}–${to ?? ""} / ${period ?? ""}`.replace(/\s+/g, " ").trim());
  }
  return lines.join("\n");
}

function mapNoFluffJobsPosting(posting: NoFluffJobsPosting): RawJobPayload {
  const sourceUrl = `https://nofluffjobs.com/job/${posting.url}`;
  return {
    externalId: posting.id,
    sourceUrl,
    applyUrl: sourceUrl,
    rawTitle: posting.title,
    rawLocation: buildLocation(posting),
    companyName: posting.name,
    description: buildDescription(posting),
    postedAt: posting.posted ? new Date(posting.posted) : undefined,
    rawPayload: posting,
  };
}

/**
 * No Fluff Jobs' public `/api/posting` endpoint returns its entire current catalog
 * in one response (query params for paging are accepted but silently ignored) —
 * unlike Himalayas this is inherently IT-only (`flavors: ["it"]` on every posting),
 * so unlike Himalayas there's no non-tech majority to page around; fetching it whole
 * each run mirrors the RemoteOK adapter's approach to its own whole-catalog feed.
 * Per-job detail pages exist but require one request per job — deliberately not
 * used here to avoid an N-thousand-request fetch every run; see `buildDescription`.
 */
export function createNoFluffJobsAdapter(config: NoFluffJobsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "nofluffjobs",
    async fetchJobs(): Promise<FetchJobsResult> {
      const data = await fetchJson<NoFluffJobsResponse>("https://nofluffjobs.com/api/posting", {
        ...config.http,
        headers: { Accept: "application/json", ...config.http?.headers },
      });
      return { jobs: data.postings.map(mapNoFluffJobsPosting) };
    },
  };
}
