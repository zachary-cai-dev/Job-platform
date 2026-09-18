import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import { asNumber, sleep, toEmploymentType, toRemoteType, toSalaryPeriod, validDate } from "../shared/fieldMapping.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface PinpointCompanyConfig { subdomain: string; companyName: string; companyUrl?: string }
export interface PinpointAdapterConfig { companies: PinpointCompanyConfig[]; requestDelayMs?: number; http?: HttpClientConfig }

interface PinpointJob {
  id?: string | number; title?: string; url?: string; description?: string; benefits?: string;
  key_responsibilities?: string; skills_knowledge_expertise?: string; employment_type?: string;
  workplace_type?: string; published_at?: string; created_at?: string;
  compensation_minimum?: number | string; compensation_maximum?: number | string;
  compensation_currency?: string; compensation_frequency?: string;
  location?: { name?: string; city?: string; province?: string; country?: string };
}
interface PinpointResponse { data?: PinpointJob[] }

export function mapPinpointJob(job: PinpointJob, company: PinpointCompanyConfig): RawJobPayload | null {
  if (job.id == null || !job.title || !job.url) return null;
  const description = [job.description, job.key_responsibilities, job.skills_knowledge_expertise, job.benefits]
    .filter(Boolean).join("\n");
  const location = job.location
    ? [job.location.name, job.location.city, job.location.province, job.location.country].filter(Boolean).join(", ")
    : undefined;
  return {
    externalId: String(job.id),
    sourceUrl: job.url,
    applyUrl: job.url,
    rawTitle: job.title,
    rawLocation: location,
    companyName: company.companyName,
    companyUrl: company.companyUrl,
    remoteType: toRemoteType(job.workplace_type),
    employmentType: toEmploymentType(job.employment_type),
    salaryMin: asNumber(job.compensation_minimum),
    salaryMax: asNumber(job.compensation_maximum),
    salaryCurrency: job.compensation_currency,
    salaryPeriod: toSalaryPeriod(job.compensation_frequency),
    description,
    postedAt: validDate(job.published_at ?? job.created_at),
    rawPayload: job,
  };
}

export function createPinpointAdapter(config: PinpointAdapterConfig): JobSourceAdapter {
  return {
    source: "pinpoint",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const [index, company] of config.companies.entries()) {
        if (index > 0) await sleep(config.requestDelayMs ?? 500);
        const response = await fetchJson<PinpointResponse>(
          `https://${company.subdomain}.pinpointhq.com/postings.json`, config.http,
        );
        for (const job of response.data ?? []) {
          const mapped = mapPinpointJob(job, company);
          if (mapped) jobs.push(mapped);
        }
      }
      return { jobs };
    },
  };
}
