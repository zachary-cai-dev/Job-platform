import * as cheerio from "cheerio";
import { fetchText, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsOptions, FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { RemoteYeahJobPosting } from "./types.js";

export interface RemoteYeahAdapterConfig {
  /** RemoteYeah category-page slugs to discover job URLs from, e.g. "remote-python-jobs". */
  categorySlugs?: string[];
  maxJobs?: number;
  requestDelayMs?: number;
  parserVersion?: number;
  http?: HttpClientConfig;
}

const DEFAULT_CATEGORY_SLUGS = [
  "remote-software-engineer-jobs",
  "remote-backend-engineer-jobs",
  "remote-frontend-engineer-jobs",
  "remote-data-engineer-jobs",
  "remote-devops-engineer-jobs",
  "remote-machine-learning-engineer-jobs",
  "remote-ai-native-engineer-jobs",
  "remote-android-developer-jobs",
  "remote-ios-developer-jobs",
  "remote-nodejs-jobs",
  "remote-reactjs-jobs",
  "remote-typescript-jobs",
  "remote-python-jobs",
  "remote-javascript-jobs",
  "remote-go-jobs",
  "remote-rust-jobs",
  "remote-php-jobs",
  "remote-ruby-jobs",
  "remote-net-jobs",
  "remote-java-jobs",
  "remote-full-stack-engineer-jobs",
];

const DEFAULT_MAX_JOBS = 300;
const DEFAULT_REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * RemoteYeah has no listing/search API — this discovers current job URLs from the
 * category pages' own rendered HTML, which is otherwise untouched (no selector-
 * based field extraction here; that's left entirely to the JSON-LD on each job's
 * own page). A category page can legitimately link off-site (e.g. a company's own
 * "remote culture" handbook page happened to also contain "/jobs/" in its path in
 * one observed case) — every candidate link is resolved and checked against
 * remoteyeah.com's own `/jobs/...` path, not just matched by substring, so an
 * external link never gets treated as one of this site's own job postings.
 */
function extractJobUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let resolved: URL;
    try {
      resolved = new URL(href, "https://remoteyeah.com");
    } catch {
      return;
    }
    if (resolved.hostname === "remoteyeah.com" && resolved.pathname.startsWith("/jobs/")) {
      urls.add(resolved.toString());
    }
  });
  return [...urls];
}

/**
 * RemoteYeah embeds a standard schema.org JobPosting JSON-LD block on every job
 * page (for Google for Jobs indexing) — reading that structured block is the whole
 * parsing strategy here, deliberately avoiding any dependency on the page's visible
 * CSS classes/layout, which is far more likely to change on a redesign than a
 * search-engine-facing structured-data contract.
 */
function extractJobPosting(html: string, url: string): RemoteYeahJobPosting | null {
  const $ = cheerio.load(html);
  const blocks = $('script[type="application/ld+json"]');
  for (const el of blocks.toArray()) {
    const raw = $(el).contents().text();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && (parsed as { "@type"?: string })["@type"] === "JobPosting") {
        return parsed as RemoteYeahJobPosting;
      }
    } catch {
      // Try the next block — a malformed unrelated block (WebSite/Organization/BreadcrumbList) shouldn't abort the search for the JobPosting one.
    }
  }
  console.warn(`[remoteyeah] no JobPosting JSON-LD found on ${url}`);
  return null;
}

function buildLocation(posting: RemoteYeahJobPosting): string {
  const countries = posting.applicantLocationRequirements?.map((r) => r.name) ?? [];
  if (countries.length) return countries.join(", ");
  return posting.jobLocationType === "TELECOMMUTE" ? "Remote" : "Unspecified";
}

function buildDescription(posting: RemoteYeahJobPosting): string {
  const lines: string[] = [];
  if (posting.employmentType?.length) lines.push(`Employment type: ${posting.employmentType.join(", ")}`);
  if (posting.skills) lines.push(`Skills: ${posting.skills}`);
  if (posting.baseSalary?.value) {
    const { minValue, maxValue, unitText } = posting.baseSalary.value;
    const range = [minValue, maxValue].filter((v) => v != null).join("–");
    if (range) lines.push(`Salary: ${posting.baseSalary.currency ?? ""} ${range} / ${unitText ?? ""}`.replace(/\s+/g, " ").trim());
  }
  lines.push(posting.description);
  return lines.join("\n\n");
}

function mapJobPosting(url: string, posting: RemoteYeahJobPosting, parserVersion: number): RawJobPayload {
  return {
    externalId: url,
    sourceUrl: url,
    applyUrl: url,
    rawTitle: posting.title,
    rawLocation: buildLocation(posting),
    companyName: posting.hiringOrganization?.name ?? "Unknown",
    description: buildDescription(posting),
    postedAt: posting.datePosted ? new Date(posting.datePosted) : undefined,
    rawPayload: { ...posting, parserVersion },
  };
}

/**
 * RemoteYeah publishes no API or feed — this reads its own public pages, which its
 * robots.txt explicitly permits (`Disallow:` is empty, and it publishes a sitemap).
 * Job URLs are discovered from category-page listings (current/active postings
 * only, not the full historical sitemap); each job's data comes from its
 * schema.org JobPosting JSON-LD, not selector-based scraping of visible markup —
 * see `extractJobPosting`'s doc comment for why. `requestDelayMs` paces the
 * per-job detail fetches so this stays a polite, sequential crawl.
 */
export function createRemoteYeahAdapter(config: RemoteYeahAdapterConfig = {}): JobSourceAdapter {
  const categorySlugs = config.categorySlugs ?? DEFAULT_CATEGORY_SLUGS;
  const maxJobs = config.maxJobs ?? DEFAULT_MAX_JOBS;
  const requestDelayMs = config.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  const parserVersion = config.parserVersion ?? 1;

  return {
    source: "remoteyeah",
    async fetchJobs(options: FetchJobsOptions = {}): Promise<FetchJobsResult> {
      const jobUrls = new Set<string>();
      for (const slug of categorySlugs) {
        const html = await fetchText(`https://remoteyeah.com/${slug}`, config.http);
        for (const url of extractJobUrls(html)) jobUrls.add(url);
      }

      const seenKnownExternalIds = [...jobUrls].filter((url) => options.knownExternalIds?.has(url));
      const urls = [...jobUrls]
        .filter((url) => !options.knownExternalIds?.has(url))
        .slice(0, maxJobs);
      const jobs: RawJobPayload[] = [];

      for (const url of urls) {
        try {
          const html = await fetchText(url, config.http);
          const posting = extractJobPosting(html, url);
          if (posting) jobs.push(mapJobPosting(url, posting, parserVersion));
        } catch (error) {
          // One job page failing (network error, unexpected 403/404, ...) shouldn't
          // abort the whole run — log and move on to the rest of the batch.
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[remoteyeah] failed to fetch job page ${url}: ${message}`);
        }
        if (requestDelayMs > 0) await sleep(requestDelayMs);
      }

      return { jobs, seenKnownExternalIds };
    },
  };
}
