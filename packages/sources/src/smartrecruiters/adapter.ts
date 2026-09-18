import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type {
  SmartRecruitersPostingDetail,
  SmartRecruitersPostingsListResponse,
  SmartRecruitersPostingSummary,
} from "./types.js";

export interface SmartRecruitersCompanyConfig {
  /** The SmartRecruiters company identifier, e.g. "Cint" (from jobs.smartrecruiters.com/<identifier>/...). */
  companyIdentifier: string;
  companyName: string;
}

export interface SmartRecruitersAdapterConfig {
  companies: SmartRecruitersCompanyConfig[];
  http?: HttpClientConfig;
}

const PAGE_SIZE = 100;

async function fetchAllPostingSummaries(
  companyIdentifier: string,
  http?: HttpClientConfig,
): Promise<SmartRecruitersPostingSummary[]> {
  const all: SmartRecruitersPostingSummary[] = [];
  let offset = 0;

  for (;;) {
    const data = await fetchJson<SmartRecruitersPostingsListResponse>(
      `https://api.smartrecruiters.com/v1/companies/${companyIdentifier}/postings?offset=${offset}&limit=${PAGE_SIZE}`,
      http,
    );
    all.push(...data.content);
    offset += data.content.length;
    if (data.content.length === 0 || offset >= data.totalFound) break;
  }

  return all;
}

function buildDescription(jobAd: SmartRecruitersPostingDetail["jobAd"]): string {
  if (!jobAd?.sections) return "";
  return Object.values(jobAd.sections)
    .map((section) => section?.text ?? "")
    .filter(Boolean)
    .join("\n");
}

function mapPostingDetail(detail: SmartRecruitersPostingDetail, companyName: string): RawJobPayload {
  return {
    externalId: detail.id,
    sourceUrl: detail.postingUrl,
    applyUrl: detail.applyUrl,
    companyName,
    rawTitle: detail.name,
    rawLocation: detail.location?.fullLocation,
    description: buildDescription(detail.jobAd),
    postedAt: detail.releasedDate ? new Date(detail.releasedDate) : undefined,
    rawPayload: detail,
  };
}

/**
 * Unlike Greenhouse/Lever/Ashby, SmartRecruiters' list endpoint doesn't include the
 * full job description — only a per-posting detail call does. This is an N+1
 * fetch pattern (one list call, then one detail call per posting), a real
 * performance characteristic of this source, not an oversight — acceptable at MVP
 * scale (brief §36: freshness/accuracy over volume) since `packages/sources`
 * adapters are configured with a curated, modest company list, not "every
 * SmartRecruiters customer." A future optimization could pre-filter postings by
 * title/department before fetching details, if a company's board grows large.
 */
export function createSmartRecruitersAdapter(config: SmartRecruitersAdapterConfig): JobSourceAdapter {
  return {
    source: "smartrecruiters",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const company of config.companies) {
        const summaries = await fetchAllPostingSummaries(company.companyIdentifier, config.http);
        for (const summary of summaries) {
          const detail = await fetchJson<SmartRecruitersPostingDetail>(
            `https://api.smartrecruiters.com/v1/companies/${company.companyIdentifier}/postings/${summary.id}`,
            config.http,
          );
          jobs.push(mapPostingDetail(detail, company.companyName));
        }
      }
      return { jobs };
    },
  };
}
