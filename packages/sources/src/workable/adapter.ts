import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import { asNumber, sleep, toEmploymentType, toRemoteType, toSalaryPeriod, validDate } from "../shared/fieldMapping.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface WorkableCompanyConfig { subdomain: string; companyName: string; companyUrl?: string }
export interface WorkableAdapterConfig {
  companies: WorkableCompanyConfig[];
  requestDelayMs?: number;
  http?: HttpClientConfig;
}

interface WorkableJob {
  id?: string; code?: string; shortcode?: string; title?: string; description?: string;
  country?: string; state?: string; city?: string; location?: string;
  telecommuting?: boolean; workplace_type?: string; employment_type?: string;
  published_on?: string; url?: string; shortlink?: string; application_url?: string;
  locations?: Array<{ city?: string; state?: string; country?: string }>;
  salary?: { salary_from?: number; salary_to?: number; salary_currency?: string; salary_period?: string };
}
interface WorkableResponse { jobs?: WorkableJob[] }

export function mapWorkableJob(job: WorkableJob, company: WorkableCompanyConfig): RawJobPayload | null {
  const externalId = job.shortcode ?? job.code ?? job.id;
  const canonicalUrl = job.url ?? job.shortlink ?? job.application_url;
  if (!externalId || !canonicalUrl || !job.title) return null;
  const location = job.location ?? (job.locations?.length
    ? job.locations.map((item) => [item.city, item.state, item.country].filter(Boolean).join(", ")).join("; ")
    : [job.city, job.state, job.country].filter(Boolean).join(", "));
  return {
    externalId: String(externalId),
    sourceUrl: canonicalUrl,
    applyUrl: job.application_url ?? canonicalUrl,
    rawTitle: job.title,
    rawLocation: location || undefined,
    companyName: company.companyName,
    companyUrl: company.companyUrl,
    remoteType: job.telecommuting ? "FULLY_REMOTE" : toRemoteType(job.workplace_type),
    employmentType: toEmploymentType(job.employment_type),
    salaryMin: asNumber(job.salary?.salary_from),
    salaryMax: asNumber(job.salary?.salary_to),
    salaryCurrency: job.salary?.salary_currency,
    salaryPeriod: toSalaryPeriod(job.salary?.salary_period),
    description: job.description ?? "",
    postedAt: validDate(job.published_on),
    rawPayload: job,
  };
}

export function createWorkableAdapter(config: WorkableAdapterConfig): JobSourceAdapter {
  return {
    source: "workable",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobsById = new Map<string, RawJobPayload>();
      for (const [index, company] of config.companies.entries()) {
        if (index > 0) await sleep(config.requestDelayMs ?? 500);
        const data = await fetchJson<WorkableResponse>(
          `https://www.workable.com/api/accounts/${encodeURIComponent(company.subdomain)}?details=true`,
          config.http,
        );
        for (const job of data.jobs ?? []) {
          const mapped = mapWorkableJob(job, company);
          if (!mapped) continue;
          const existing = jobsById.get(mapped.externalId);
          if (!existing) {
            jobsById.set(mapped.externalId, mapped);
            continue;
          }
          const locations = [existing.rawLocation, mapped.rawLocation].filter(Boolean);
          existing.rawLocation = [...new Set(locations)].join("; ") || undefined;
          existing.rawPayload = Array.isArray(existing.rawPayload)
            ? [...existing.rawPayload, mapped.rawPayload]
            : [existing.rawPayload, mapped.rawPayload];
        }
      }
      return { jobs: [...jobsById.values()] };
    },
  };
}
