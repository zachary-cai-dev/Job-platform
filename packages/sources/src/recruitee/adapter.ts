import * as cheerio from "cheerio";
import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { asNumber, sleep, toEmploymentType, toSalaryPeriod, validDate } from "../shared/fieldMapping.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface RecruiteeCompanyConfig { subdomain: string; companyName: string; companyUrl?: string }
export interface RecruiteeAdapterConfig { companies: RecruiteeCompanyConfig[]; requestDelayMs?: number; http?: HttpClientConfig }

function decodeHtml(value: string): string {
  if (!value.includes("&lt;")) return value;
  const decoded = cheerio.load(value).text();
  return decoded.includes("<") ? decoded : value;
}

export function parseRecruiteeFeed(xml: string, company: RecruiteeCompanyConfig): RawJobPayload[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs: RawJobPayload[] = [];
  $("offers > offer").each((_, element) => {
    const offer = $(element);
    const externalId = offer.children("guid").text().trim() || offer.children("id").text().trim();
    const title = offer.children("title").text().trim();
    const canonicalUrl = offer.children("careers-url").text().trim();
    if (!externalId || !title || !canonicalUrl) return;
    const location = offer.children("location").text().trim()
      || [offer.children("city").text(), offer.children("state-name").text(), offer.children("country").text()]
        .filter(Boolean).join(", ");
    const description = [offer.children("description").text(), offer.children("requirements").text()]
      .filter(Boolean).map(decodeHtml).join("\n");
    const remote = offer.children("remote").text().trim() === "true";
    const hybrid = offer.children("hybrid").text().trim() === "true";
    const salary = offer.children("salary");
    jobs.push({
      externalId,
      sourceUrl: canonicalUrl,
      applyUrl: offer.children("careers-apply-url").text().trim() || canonicalUrl,
      rawTitle: title,
      rawLocation: location || undefined,
      companyName: company.companyName,
      companyUrl: company.companyUrl,
      remoteType: hybrid ? "HYBRID" : remote ? "FULLY_REMOTE" : "UNKNOWN",
      employmentType: toEmploymentType(offer.children("employment-type-code").text()),
      salaryMin: asNumber(salary.children("min").text()),
      salaryMax: asNumber(salary.children("max").text()),
      salaryCurrency: salary.children("currency").text().trim() || undefined,
      salaryPeriod: toSalaryPeriod(salary.children("period").text()),
      description,
      postedAt: validDate(offer.children("published-at").text() || offer.children("created-at").text()),
      rawPayload: {
        id: offer.children("id").text(), guid: externalId, title, canonicalUrl, location,
        remote, hybrid, onSite: offer.children("on-site").text(),
        department: offer.children("department").text(), employmentType: offer.children("employment-type-code").text(),
        publishedAt: offer.children("published-at").text(), createdAt: offer.children("created-at").text(),
      },
    });
  });
  return jobs;
}

export function createRecruiteeAdapter(config: RecruiteeAdapterConfig): JobSourceAdapter {
  return {
    source: "recruitee",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const [index, company] of config.companies.entries()) {
        if (index > 0) await sleep(config.requestDelayMs ?? 500);
        const xml = await fetchText(`https://${company.subdomain}.recruitee.com/api/offers.xml`, config.http);
        jobs.push(...parseRecruiteeFeed(xml, company));
      }
      return { jobs };
    },
  };
}
