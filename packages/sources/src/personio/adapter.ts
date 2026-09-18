import * as cheerio from "cheerio";
import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { sleep, toEmploymentType, toRemoteType, validDate } from "../shared/fieldMapping.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface PersonioCompanyConfig {
  account: string; companyName: string; companyUrl?: string; host?: "jobs.personio.com" | "jobs.personio.de";
}
export interface PersonioAdapterConfig {
  companies: PersonioCompanyConfig[]; language?: string; requestDelayMs?: number; http?: HttpClientConfig;
}

export function parsePersonioFeed(xml: string, company: PersonioCompanyConfig, language = "en"): RawJobPayload[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs: RawJobPayload[] = [];
  $("position").each((_, element) => {
    const position = $(element);
    const externalId = position.children("id").first().text().trim();
    const title = position.children("name").first().text().trim();
    if (!externalId || !title) return;
    const offices = [
      position.children("office").first().text().trim(),
      ...position.children("additionalOffices").find("office").map((__, node) => $(node).text().trim()).get(),
    ].filter(Boolean);
    const descriptions = position.find("jobDescriptions > jobDescription").map((__, node) => {
      const section = $(node);
      const heading = section.children("name").text().trim();
      const body = section.children("value").text().trim();
      return `${heading ? `<h2>${heading}</h2>` : ""}${body}`;
    }).get();
    const description = descriptions.join("\n");
    const host = company.host ?? "jobs.personio.com";
    const canonicalUrl = `https://${company.account}.${host}/job/${externalId}?language=${encodeURIComponent(language)}`;
    jobs.push({
      externalId,
      sourceUrl: canonicalUrl,
      applyUrl: canonicalUrl,
      rawTitle: title,
      rawLocation: offices.join(", ") || undefined,
      companyName: company.companyName,
      companyUrl: company.companyUrl,
      remoteType: toRemoteType(`${offices.join(" ")} ${description.slice(0, 1000)}`),
      employmentType: toEmploymentType(`${position.children("employmentType").text()} ${position.children("schedule").text()}`),
      description,
      postedAt: validDate(position.children("createdAt").text()),
      rawPayload: {
        id: externalId, subcompany: position.children("subcompany").text(), offices,
        department: position.children("department").text(), recruitingCategory: position.children("recruitingCategory").text(),
        employmentType: position.children("employmentType").text(), seniority: position.children("seniority").text(),
        schedule: position.children("schedule").text(), createdAt: position.children("createdAt").text(),
      },
    });
  });
  return jobs;
}

export function createPersonioAdapter(config: PersonioAdapterConfig): JobSourceAdapter {
  return {
    source: "personio",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const [index, company] of config.companies.entries()) {
        if (index > 0) await sleep(config.requestDelayMs ?? 500);
        const host = company.host ?? "jobs.personio.com";
        const language = config.language ?? "en";
        const xml = await fetchText(`https://${company.account}.${host}/xml?language=${encodeURIComponent(language)}`, config.http);
        jobs.push(...parsePersonioFeed(xml, company, language));
      }
      return { jobs };
    },
  };
}
