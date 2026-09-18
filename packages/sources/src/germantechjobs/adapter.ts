import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { parseRssItems } from "../shared/rss.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface GermanTechJobsAdapterConfig {
  http?: HttpClientConfig;
}

/** GermanTechJobs titles are "Job Title @ Company [salary range]" (the bracket is optional). */
function parseTitle(rawTitle: string): { title: string; companyName: string; salary?: string } {
  const match = /^(.+?)\s*@\s*([^[]+?)(?:\s*\[(.+)\])?$/.exec(rawTitle);
  if (!match?.[1] || !match[2]) return { title: rawTitle, companyName: "Unknown" };
  return { title: match[1].trim(), companyName: match[2].trim(), salary: match[3]?.trim() };
}

/** GermanTechJobs lists tech roles at German companies exclusively — always Germany-eligible. */
export function createGermanTechJobsAdapter(config: GermanTechJobsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "germantechjobs",
    async fetchJobs(): Promise<FetchJobsResult> {
      const xml = await fetchText("https://germantechjobs.de/rss", config.http);
      const jobs = parseRssItems(xml).map((item): RawJobPayload => {
        const rawTitle = item.get("title") ?? "";
        const { title, companyName, salary } = parseTitle(rawTitle);
        const link = item.get("link") ?? "";
        const pubDate = item.get("pubDate");
        const description = [salary ? `Salary: ${salary}` : undefined, item.get("description")]
          .filter(Boolean)
          .join("\n\n");
        return {
          externalId: item.get("guid") ?? link,
          sourceUrl: link,
          applyUrl: link,
          rawTitle: title,
          rawLocation: "Germany",
          companyName,
          description,
          postedAt: pubDate ? new Date(pubDate) : undefined,
          rawPayload: { title: rawTitle, link },
        };
      });
      return { jobs };
    },
  };
}
