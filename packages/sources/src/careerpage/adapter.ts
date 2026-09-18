import * as cheerio from "cheerio";
import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { asNumber, sleep, toEmploymentType, toSalaryPeriod, validDate } from "../shared/fieldMapping.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface CareerPageCompanyConfig {
  companyName: string;
  companyUrl?: string;
  urls?: string[];
  sitemapUrl?: string;
  /** Required for sitemap discovery; only matching URLs on the sitemap's origin are fetched. */
  jobUrlPattern?: string;
}
export interface CareerPageAdapterConfig {
  companies: CareerPageCompanyConfig[];
  maxJobs?: number;
  maxSitemapPages?: number;
  requestDelayMs?: number;
  http?: HttpClientConfig;
}

interface JsonLdJob {
  "@type"?: string | string[]; identifier?: string | { value?: string };
  title?: string; description?: string; url?: string; datePosted?: string;
  employmentType?: string | string[]; jobLocationType?: string;
  hiringOrganization?: { name?: string; sameAs?: string };
  jobLocation?: Array<{ address?: Record<string, string> }> | { address?: Record<string, string> };
  applicantLocationRequirements?: Array<{ name?: string }> | { name?: string };
  baseSalary?: { currency?: string; value?: number | { minValue?: number; maxValue?: number; value?: number; unitText?: string }; unitText?: string };
}

function flattenJsonLd(value: unknown): JsonLdJob[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record as JsonLdJob, ...flattenJsonLd(record["@graph"])];
}

function isJobPosting(value: JsonLdJob): boolean {
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  return types.some((type) => String(type).toLowerCase() === "jobposting");
}

function locationText(job: JsonLdJob): string | undefined {
  const locations = Array.isArray(job.jobLocation) ? job.jobLocation : job.jobLocation ? [job.jobLocation] : [];
  const parts = locations.flatMap((location) => {
    const address = location.address ?? {};
    return [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean);
  });
  const requirements = Array.isArray(job.applicantLocationRequirements)
    ? job.applicantLocationRequirements : job.applicantLocationRequirements ? [job.applicantLocationRequirements] : [];
  parts.push(...requirements.map((item) => item.name).filter((value): value is string => Boolean(value)));
  return [...new Set(parts)].join(", ") || undefined;
}

export function parseCareerPage(html: string, pageUrl: string, company: CareerPageCompanyConfig): RawJobPayload[] {
  const $ = cheerio.load(html);
  const canonical = $("link[rel='canonical']").attr("href");
  const payloads: RawJobPayload[] = [];
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      const parsed: unknown = JSON.parse($(element).text());
      for (const job of flattenJsonLd(parsed).filter(isJobPosting)) {
        const canonicalUrl = new URL(job.url ?? canonical ?? pageUrl, pageUrl).toString();
        if (!job.title) continue;
        const identifier = typeof job.identifier === "string" ? job.identifier : job.identifier?.value;
        const salaryValue = typeof job.baseSalary?.value === "number"
          ? { value: job.baseSalary.value }
          : job.baseSalary?.value;
        const employment = Array.isArray(job.employmentType) ? job.employmentType.join(" ") : job.employmentType;
        payloads.push({
          externalId: identifier ?? canonicalUrl,
          sourceUrl: canonicalUrl,
          applyUrl: canonicalUrl,
          rawTitle: job.title,
          rawLocation: locationText(job),
          companyName: job.hiringOrganization?.name ?? company.companyName,
          companyUrl: job.hiringOrganization?.sameAs ?? company.companyUrl,
          remoteType: String(job.jobLocationType).toUpperCase().includes("TELECOMMUTE") ? "FULLY_REMOTE" : "UNKNOWN",
          employmentType: toEmploymentType(employment),
          salaryMin: asNumber(salaryValue?.minValue ?? salaryValue?.value),
          salaryMax: asNumber(salaryValue?.maxValue ?? salaryValue?.value),
          salaryCurrency: job.baseSalary?.currency,
          salaryPeriod: toSalaryPeriod(salaryValue?.unitText ?? job.baseSalary?.unitText),
          description: job.description ?? "",
          postedAt: validDate(job.datePosted),
          rawPayload: job,
        });
      }
    } catch {
      // One malformed JSON-LD block must not hide other valid blocks on the page.
    }
  });
  return payloads;
}

function sitemapLocations(xml: string, selector: "url" | "sitemap"): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $(`${selector} > loc`).map((_, node) => $(node).text().trim()).get().filter(Boolean);
}

export function createCareerPageAdapter(config: CareerPageAdapterConfig): JobSourceAdapter {
  return {
    source: "careerpage",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      let requests = 0;
      for (const company of config.companies) {
        const urls = new Set(company.urls ?? []);
        if (company.sitemapUrl && company.jobUrlPattern) {
          const origin = new URL(company.sitemapUrl).origin;
          const pattern = new RegExp(company.jobUrlPattern, "i");
          const sitemapQueue = [company.sitemapUrl];
          const visitedSitemaps = new Set<string>();
          while (sitemapQueue.length > 0 && visitedSitemaps.size < (config.maxSitemapPages ?? 10)) {
            const sitemapUrl = sitemapQueue.shift();
            if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;
            visitedSitemaps.add(sitemapUrl);
            if (requests++ > 0) await sleep(config.requestDelayMs ?? 500);
            const sitemap = await fetchText(sitemapUrl, config.http);
            for (const nested of sitemapLocations(sitemap, "sitemap")) {
              try {
                if (new URL(nested).origin === origin && !visitedSitemaps.has(nested)) sitemapQueue.push(nested);
              } catch { /* skip malformed sitemap URL */ }
            }
            for (const url of sitemapLocations(sitemap, "url")) {
              try {
                if (new URL(url).origin === origin && pattern.test(url)) urls.add(url);
              } catch { /* skip malformed sitemap URL */ }
            }
          }
        }
        for (const url of urls) {
          if (jobs.length >= (config.maxJobs ?? 100)) return { jobs };
          if (requests++ > 0) await sleep(config.requestDelayMs ?? 500);
          const html = await fetchText(url, config.http);
          jobs.push(...parseCareerPage(html, url, company));
        }
      }
      return { jobs: jobs.slice(0, config.maxJobs ?? 100) };
    },
  };
}
