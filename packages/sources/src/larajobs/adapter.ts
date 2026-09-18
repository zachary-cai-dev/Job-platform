import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { parseRssItems } from "../shared/rss.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface LaraJobsAdapterConfig {
  http?: HttpClientConfig;
}

/**
 * LaraJobs' feed carries structured `job:*` namespaced fields but its
 * `<description>`/`<content:encoded>` tags are consistently empty (verified live —
 * every item in the feed, not just one), so — like No Fluff Jobs' listing endpoint —
 * this synthesizes a plain-text description from the structured fields instead.
 */
function buildDescription(item: {
  jobType?: string;
  salary?: string;
  tags?: string;
  location?: string;
}): string {
  const lines: string[] = [];
  if (item.jobType) lines.push(`Employment type: ${item.jobType.replace(/_/g, " ")}`);
  if (item.salary) lines.push(`Salary: ${item.salary}`);
  if (item.location) lines.push(`Location: ${item.location}`);
  if (item.tags) lines.push(`Tags: ${item.tags}`);
  return lines.join("\n");
}

/** LaraJobs is a Laravel-ecosystem PHP job board — every listing is inherently a tech role. */
export function createLaraJobsAdapter(config: LaraJobsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "larajobs",
    async fetchJobs(): Promise<FetchJobsResult> {
      const xml = await fetchText("https://larajobs.com/feed", config.http);
      const jobs = parseRssItems(xml).map((item): RawJobPayload => {
        const link = item.get("link") ?? "";
        const pubDate = item.get("pubDate");
        const jobType = item.get("job:job_type");
        const salary = item.get("job:salary");
        const tags = item.get("job:tags");
        const location = item.get("job:location");
        return {
          externalId: item.get("guid") ?? link,
          sourceUrl: link,
          applyUrl: link,
          rawTitle: item.get("title") ?? "",
          rawLocation: location,
          companyName: item.get("job:company") ?? item.get("dc:creator") ?? "Unknown",
          description: buildDescription({ jobType, salary, tags, location }),
          postedAt: pubDate ? new Date(pubDate) : undefined,
          rawPayload: { link, jobType, salary, tags, location },
        };
      });
      return { jobs };
    },
  };
}
