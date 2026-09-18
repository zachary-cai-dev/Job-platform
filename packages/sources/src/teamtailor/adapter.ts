import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { validDate, sleep, toRemoteType } from "../shared/fieldMapping.js";
import { parseRssItems, type RssItem } from "../shared/rss.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface TeamtailorCompanyConfig { feedUrl: string; companyName: string; companyUrl?: string }
export interface TeamtailorAdapterConfig {
  companies: TeamtailorCompanyConfig[]; maxPages?: number; pageSize?: number;
  requestDelayMs?: number; http?: HttpClientConfig;
}

export function mapTeamtailorItem(item: RssItem, company: TeamtailorCompanyConfig): RawJobPayload | null {
  const canonicalUrl = item.get("link");
  const title = item.get("title");
  if (!canonicalUrl || !title) return null;
  const guid = item.get("guid") ?? canonicalUrl;
  const locations = [item.get("tt:name"), item.get("tt:city"), item.get("tt:country")]
    .filter(Boolean).join(", ");
  return {
    externalId: guid,
    sourceUrl: canonicalUrl,
    applyUrl: canonicalUrl,
    rawTitle: title,
    rawLocation: locations || undefined,
    companyName: company.companyName,
    companyUrl: company.companyUrl,
    remoteType: toRemoteType(item.get("remoteStatus")),
    description: item.get("description") ?? "",
    postedAt: validDate(item.get("pubDate")),
    rawPayload: {
      guid, title, canonicalUrl, locations,
      remoteStatus: item.get("remoteStatus"), department: item.get("tt:department"),
      role: item.get("tt:role"), division: item.get("tt:division"),
    },
  };
}

export function createTeamtailorAdapter(config: TeamtailorAdapterConfig): JobSourceAdapter {
  const pageSize = Math.min(config.pageSize ?? 100, 100);
  const maxPages = config.maxPages ?? 10;
  return {
    source: "teamtailor",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      const seen = new Set<string>();
      let requestCount = 0;
      for (const company of config.companies) {
        for (let page = 0; page < maxPages; page++) {
          if (requestCount++ > 0) await sleep(config.requestDelayMs ?? 500);
          const url = new URL(company.feedUrl);
          url.searchParams.set("per_page", String(pageSize));
          url.searchParams.set("offset", String(page * pageSize));
          const items = parseRssItems(await fetchText(url.toString(), config.http));
          let newCount = 0;
          for (const item of items) {
            const mapped = mapTeamtailorItem(item, company);
            if (mapped && !seen.has(mapped.externalId)) {
              seen.add(mapped.externalId);
              jobs.push(mapped);
              newCount++;
            }
          }
          if (items.length < pageSize || newCount === 0) break;
        }
      }
      return { jobs };
    },
  };
}
