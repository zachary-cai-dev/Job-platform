import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import { parseRssItems } from "../shared/rss.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";

export interface PythonJobsAdapterConfig {
  http?: HttpClientConfig;
}

/** Python.org job titles are "Job Title, Company Name" — the company is the trailing segment. */
function parseTitle(rawTitle: string): { title: string; companyName: string } {
  const idx = rawTitle.lastIndexOf(",");
  if (idx === -1) return { title: rawTitle, companyName: "Unknown" };
  return { title: rawTitle.slice(0, idx).trim(), companyName: rawTitle.slice(idx + 1).trim() };
}

/**
 * Python.org's description starts with a plain-text location line (often a
 * comma-separated repeat like "Remote, Remote/Worldwide, Remote/Worldwide, Remote")
 * before the HTML body begins at the first tag — split there to recover a
 * `rawLocation` hint for the geography evaluator.
 */
function splitLocationAndBody(description: string): { rawLocation: string | undefined; body: string } {
  const tagIndex = description.indexOf("<");
  if (tagIndex <= 0) return { rawLocation: undefined, body: description };
  return { rawLocation: description.slice(0, tagIndex).trim(), body: description.slice(tagIndex).trim() };
}

/**
 * Python.org's Jobs RSS feed never includes a per-item publish date (no `pubDate`
 * anywhere in the feed, only a channel-level `lastBuildDate`) — `postedAt` is left
 * undefined here, same as any source that genuinely doesn't provide one (see
 * `RawJobPayload.postedAt`'s own doc comment).
 */
export function createPythonJobsAdapter(config: PythonJobsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "pythonjobs",
    async fetchJobs(): Promise<FetchJobsResult> {
      const xml = await fetchText("https://www.python.org/jobs/feed/rss/", config.http);
      const jobs = parseRssItems(xml).map((item): RawJobPayload => {
        const rawTitle = item.get("title") ?? "";
        const { title, companyName } = parseTitle(rawTitle);
        const link = item.get("link") ?? "";
        const { rawLocation, body } = splitLocationAndBody(item.get("description") ?? "");
        return {
          externalId: item.get("guid") ?? link,
          sourceUrl: link,
          applyUrl: link,
          rawTitle: title,
          rawLocation,
          companyName,
          description: body,
          rawPayload: { title: rawTitle, link },
        };
      });
      return { jobs };
    },
  };
}
