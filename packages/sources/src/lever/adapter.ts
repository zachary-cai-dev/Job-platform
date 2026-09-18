import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { LeverPosting } from "./types.js";
import { asNumber, toEmploymentType, toRemoteType, toSalaryPeriod } from "../shared/fieldMapping.js";

export interface LeverCompanyConfig {
  /** The Lever site slug, e.g. "acme". */
  companySlug: string;
  /** Human-readable company name — not present in Lever's posting payload. */
  companyName: string;
}

export interface LeverAdapterConfig {
  companies: LeverCompanyConfig[];
  http?: HttpClientConfig;
}

function mapLeverPosting(posting: LeverPosting, companyName: string): RawJobPayload {
  return {
    externalId: posting.id,
    sourceUrl: posting.hostedUrl,
    applyUrl: posting.applyUrl ?? posting.hostedUrl,
    rawTitle: posting.text,
    rawLocation: posting.categories?.location,
    remoteType: toRemoteType(posting.workplaceType ?? posting.categories?.location),
    employmentType: toEmploymentType(posting.categories?.commitment),
    salaryMin: asNumber(posting.salaryRange?.min),
    salaryMax: asNumber(posting.salaryRange?.max),
    salaryCurrency: posting.salaryRange?.currency,
    salaryPeriod: toSalaryPeriod(posting.salaryRange?.interval),
    companyName,
    description: posting.descriptionPlain ?? "",
    // Lever's public postings API exposes a genuine creation timestamp, unlike
    // Greenhouse — this is a real postedAt, not a proxy.
    postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
    rawPayload: posting,
  };
}

export function createLeverAdapter(config: LeverAdapterConfig): JobSourceAdapter {
  return {
    source: "lever",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const company of config.companies) {
        const postings = await fetchJson<LeverPosting[]>(
          `https://api.lever.co/v0/postings/${company.companySlug}?mode=json`,
          config.http,
        );
        jobs.push(...postings.map((posting) => mapLeverPosting(posting, company.companyName)));
      }
      return { jobs };
    },
  };
}
