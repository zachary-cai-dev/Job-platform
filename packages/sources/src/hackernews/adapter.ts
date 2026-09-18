import { fetchJson, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { HackerNewsItem, HackerNewsUser } from "./types.js";

export interface HackerNewsAdapterConfig {
  /** How many comment items to fetch in parallel. Firebase's REST API has no documented rate limit, but this keeps the burst modest. */
  concurrency?: number;
  http?: HttpClientConfig;
}

const HIRING_TITLE_PATTERN = /^ask hn: who is hiring\?/i;

/**
 * The monthly "Ask HN: Who is hiring?" thread and "Ask HN: Who wants to be
 * hired?"/freelancer threads are all posted by the same account on the same day —
 * `submitted` is newest-first, so this walks a handful of the most recent items
 * until it finds the one whose title actually matches the hiring thread.
 */
async function findCurrentHiringThread(http: HttpClientConfig | undefined): Promise<HackerNewsItem | null> {
  const user = await fetchJson<HackerNewsUser>("https://hacker-news.firebaseio.com/v0/user/whoishiring.json", http);
  for (const id of user.submitted.slice(0, 10)) {
    const item = await fetchJson<HackerNewsItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, http);
    if (item.type === "story" && HIRING_TITLE_PATTERN.test(item.title ?? "")) {
      return item;
    }
  }
  return null;
}

async function fetchItemsWithLimit(
  ids: number[],
  concurrency: number,
  http: HttpClientConfig | undefined,
): Promise<HackerNewsItem[]> {
  const results: HackerNewsItem[] = new Array(ids.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= ids.length) return;
      results[i] = await fetchJson<HackerNewsItem>(`https://hacker-news.firebaseio.com/v0/item/${ids[i]}.json`, http);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, () => worker()));
  return results;
}

/**
 * Posts follow the long-standing HN convention `Company | Role | Location | Type |
 * ...<p>description`, but it's a community convention, not an enforced schema —
 * some posters omit pipes or reorder fields entirely. This makes a best effort at
 * pulling out a company name and leaves the rest of the header (title, location,
 * employment type, all mixed together) as free text for the normal downstream
 * title/geography/role-category text extractors to work with, same as they already
 * do for every other source's freeform description text.
 */
function splitHeaderAndBody(text: string): { header: string; body: string } {
  const tagIndex = text.indexOf("<p>");
  if (tagIndex === -1) return { header: text.trim(), body: "" };
  return { header: text.slice(0, tagIndex).trim(), body: text.slice(tagIndex).trim() };
}

/**
 * HN's stored comment `text` is always HTML — entities (`&#x2F;`, `&amp;`, `&#39;`,
 * ...) included, not just tags. Some posters also put a `<a href="...">link</a>`
 * inside a pipe segment instead of after it. Decode entities and strip tags before
 * this becomes `rawTitle`/`rawLocation` text (the full original markup is still
 * preserved as-is in `description`).
 */
function plainText(text: string): string {
  const withEntitiesDecoded = text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  return withEntitiesDecoded.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseHeader(header: string): { companyName: string; rest: string } {
  const cleaned = plainText(header);
  const segments = cleaned
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return { companyName: "Unknown", rest: cleaned };
  const companyName = segments[0]!.replace(/\s*\(YC\s+[^)]*\)\s*$/i, "").trim() || "Unknown";
  const rest = segments.slice(1).join(" | ");
  return { companyName, rest: rest || cleaned };
}

function mapHackerNewsComment(item: HackerNewsItem): RawJobPayload {
  const { header, body } = splitHeaderAndBody(item.text ?? "");
  const { companyName, rest } = parseHeader(header);
  const sourceUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  return {
    externalId: String(item.id),
    sourceUrl,
    applyUrl: sourceUrl,
    rawTitle: rest,
    rawLocation: rest,
    companyName,
    description: [header, body].filter(Boolean).join("\n"),
    postedAt: new Date(item.time * 1000),
    rawPayload: item,
  };
}

/**
 * Uses Hacker News's official public Firebase-backed API (hacker-news.firebaseio.com),
 * Y Combinator's own documented product for third-party consumption — no auth,
 * no rate limit stated, an N+1 fan-out (one story lookup, then one request per
 * top-level comment) that mirrors exactly how every third-party HN client is built
 * against it.
 */
export function createHackerNewsAdapter(config: HackerNewsAdapterConfig = {}): JobSourceAdapter {
  return {
    source: "hackernews",
    async fetchJobs(): Promise<FetchJobsResult> {
      const thread = await findCurrentHiringThread(config.http);
      if (!thread?.kids?.length) return { jobs: [] };

      const items = await fetchItemsWithLimit(thread.kids, config.concurrency ?? 15, config.http);
      const jobs = items
        .filter((item): item is HackerNewsItem => Boolean(item) && !item.deleted && !item.dead && Boolean(item.text))
        .map(mapHackerNewsComment);

      return { jobs };
    },
  };
}
