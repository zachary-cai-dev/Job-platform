import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { parseRssItems } from "../shared/rss.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface WeWorkRemotelyAdapterConfig {
  /**
   * Which category RSS feeds to poll, e.g. "remote-programming-jobs". Defaults to
   * WWR's tech-relevant categories — the site also has non-tech categories
   * (marketing, customer support, etc.) deliberately excluded by default.
   */
  categorySlugs?: string[];
  http?: HttpClientConfig;
}

const DEFAULT_CATEGORY_SLUGS = [
  "remote-programming-jobs",
  "remote-devops-sysadmin-jobs",
  "remote-back-end-programming-jobs",
  "remote-front-end-programming-jobs",
  "remote-full-stack-programming-jobs",
];

/** WWR titles are always "Company: Job Title" — split on the first colon. */
function splitTitle(rawTitle: string): { companyName: string; title: string } {
  const idx = rawTitle.indexOf(":");
  if (idx === -1) return { companyName: "Unknown", title: rawTitle };
  return { companyName: rawTitle.slice(0, idx).trim(), title: rawTitle.slice(idx + 1).trim() };
}

async function fetchCategoryFeed(slug: string, http: HttpClientConfig | undefined): Promise<RawJobPayload[]> {
  const xml = await fetchText(`https://weworkremotely.com/categories/${slug}.rss`, http);
  return parseRssItems(xml).map((item) => {
    const rawTitle = item.get("title") ?? "";
    const { companyName, title } = splitTitle(rawTitle);
    const link = item.get("link") ?? "";
    const pubDate = item.get("pubDate");
    return {
      externalId: item.get("guid") ?? link,
      sourceUrl: link,
      applyUrl: link,
      rawTitle: title,
      rawLocation: item.get("region"),
      companyName,
      description: item.get("description") ?? "",
      postedAt: pubDate ? new Date(pubDate) : undefined,
      rawPayload: { title: rawTitle, link, region: item.get("region"), category: item.get("category") },
    };
  });
}

export function createWeWorkRemotelyAdapter(config: WeWorkRemotelyAdapterConfig = {}): JobSourceAdapter {
  const slugs = config.categorySlugs ?? DEFAULT_CATEGORY_SLUGS;

  return {
    source: "weworkremotely",
    async fetchJobs(): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      for (const slug of slugs) {
        jobs.push(...(await fetchCategoryFeed(slug, config.http)));
      }
      return { jobs };
    },
  };
}
