import { fetchText, HttpError, type HttpClientConfig } from "../shared/httpClient.js";
import { toEmploymentType, toSalaryPeriod } from "../shared/fieldMapping.js";
import type { FetchJobsOptions, FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import {
  canonicalLinkedInJobUrl,
  detectLinkedInAccessRestriction,
  parseLinkedInJobDetail,
  parseLinkedInSearchResults,
} from "./parser.js";
import type { LinkedInSearchResult, LinkedInWorkplaceType } from "./types.js";

export type { LinkedInWorkplaceType } from "./types.js";
export type LinkedInDatePosted = "any" | "past24Hours" | "pastWeek" | "pastMonth";

interface AdapterLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  warn(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface LinkedInAdapterConfig {
  keywords: string[];
  locations: string[];
  workplaceTypes?: LinkedInWorkplaceType[];
  datePosted?: LinkedInDatePosted;
  maxJobs?: number;
  maxPages?: number;
  requestDelayMs?: number;
  /** Bump when parser/normalization changes require previously rejected details to be fetched once more. */
  parserVersion?: number;
  http?: HttpClientConfig;
  logger?: AdapterLogger;
}

const DEFAULT_MAX_JOBS = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_REQUEST_DELAY_MS = 2_000;
const PAGE_SIZE = 25;
const DATE_FILTERS: Record<Exclude<LinkedInDatePosted, "any">, string> = {
  past24Hours: "r86400",
  pastWeek: "r604800",
  pastMonth: "r2592000",
};
const WORKPLACE_FILTERS: Record<LinkedInWorkplaceType, string> = {
  "on-site": "1",
  remote: "2",
  hybrid: "3",
};

class StopLinkedInCollection extends Error {
  constructor(
    message: string,
    readonly blocked: boolean,
    readonly rateLimited: boolean,
  ) {
    super(message);
    this.name = "StopLinkedInCollection";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(
  keyword: string,
  location: string,
  page: number,
  workplaceType: LinkedInWorkplaceType | undefined,
  datePosted: LinkedInDatePosted,
): string {
  const url = new URL("https://www.linkedin.com/jobs/search/");
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("location", location);
  url.searchParams.set("start", String((page - 1) * PAGE_SIZE));
  if (workplaceType) url.searchParams.set("f_WT", WORKPLACE_FILTERS[workplaceType]);
  if (datePosted !== "any") url.searchParams.set("f_TPR", DATE_FILTERS[datePosted]);
  return url.toString();
}

function toRemoteType(workplaceType: LinkedInWorkplaceType | undefined): "FULLY_REMOTE" | "HYBRID" | "UNKNOWN" {
  if (workplaceType === "remote") return "FULLY_REMOTE";
  if (workplaceType === "hybrid") return "HYBRID";
  return "UNKNOWN";
}

function toRawJob(
  detail: NonNullable<ReturnType<typeof parseLinkedInJobDetail>>,
  html: string,
  parserVersion: number,
): RawJobPayload {
  return {
    externalId: detail.externalId,
    sourceUrl: detail.jobUrl,
    applyUrl: detail.jobUrl,
    rawTitle: detail.title,
    rawLocation: detail.location,
    companyName: detail.company,
    companyUrl: detail.companyUrl,
    description: detail.description,
    postedAt: detail.postedAt,
    remoteType: toRemoteType(detail.workplaceType),
    employmentType: toEmploymentType(detail.employmentType),
    salaryMin: detail.salary?.min,
    salaryMax: detail.salary?.max,
    salaryCurrency: detail.salary?.currency,
    salaryPeriod: toSalaryPeriod(detail.salary?.unit),
    rawPayload: { ...detail, html, parserVersion },
  };
}

/**
 * Collects only anonymous, publicly rendered LinkedIn search and job pages. It does
 * not log in, retain cookies, invoke private APIs, or attempt to work around access
 * controls. Any restriction signal aborts the run and returns the safe partial batch.
 */
export function createLinkedInAdapter(config: LinkedInAdapterConfig): JobSourceAdapter {
  const maxJobs = config.maxJobs ?? DEFAULT_MAX_JOBS;
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;
  const requestDelayMs = config.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  const datePosted = config.datePosted ?? "any";
  const logger = config.logger;
  const parserVersion = config.parserVersion ?? 1;
  let lastRequestAt = 0;

  async function request(url: string, signal?: AbortSignal): Promise<string> {
    const remainingDelay = requestDelayMs - (Date.now() - lastRequestAt);
    if (remainingDelay > 0) await sleep(remainingDelay);
    lastRequestAt = Date.now();
    try {
      const html = await fetchText(url, {
        maxRetries: 2,
        backoffBaseMs: 1_000,
        timeoutMs: 20_000,
        ...config.http,
        retry429: false,
        signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-GB,en;q=0.9",
          "User-Agent": "Mozilla/5.0 (compatible; EuroJobsBot/1.0; public job indexing)",
          ...config.http?.headers,
        },
      });
      const restriction = detectLinkedInAccessRestriction(html);
      if (restriction) throw new StopLinkedInCollection(`LinkedIn returned a ${restriction} page`, true, false);
      return html;
    } catch (error) {
      if (error instanceof HttpError && [401, 403, 429].includes(error.status)) {
        throw new StopLinkedInCollection(
          `LinkedIn returned HTTP ${error.status}`,
          error.status === 401 || error.status === 403,
          error.status === 429,
        );
      }
      throw error;
    }
  }

  return {
    source: "linkedin",
    async fetchJobs(options: FetchJobsOptions = {}): Promise<FetchJobsResult> {
      const jobs: RawJobPayload[] = [];
      const discovered = new Map<string, LinkedInSearchResult>();
      const seenSearchIds = new Set<string>();
      const seenKnownExternalIds = new Set<string>();
      let searches = 0;
      let expired = 0;
      let failed = 0;
      let blocked = false;
      let rateLimited = false;
      const workplaceTypes = config.workplaceTypes?.length ? config.workplaceTypes : [undefined];

      try {
        searchLoop: for (const keyword of config.keywords) {
          for (const location of config.locations) {
            for (const workplaceType of workplaceTypes) {
              searches += 1;
              logger?.info({ keyword, location, workplaceType }, "[linkedin] search");
              for (let page = 1; page <= maxPages; page++) {
                logger?.info({ keyword, location, workplaceType, page }, "[linkedin] result page");
                const html = await request(buildSearchUrl(keyword, location, page, workplaceType, datePosted), options.signal);
                const results = parseLinkedInSearchResults(html);
                let newOnPage = 0;
                for (const result of results) {
                  if (seenSearchIds.has(result.externalId)) continue;
                  seenSearchIds.add(result.externalId);
                  newOnPage += 1;
                  if (options.knownExternalIds?.has(result.externalId)) {
                    seenKnownExternalIds.add(result.externalId);
                    continue;
                  }
                  discovered.set(result.externalId, result);
                  if (discovered.size >= maxJobs) break;
                }
                logger?.info(
                  { page, pageCount: results.length, newOnPage, discoveredCount: discovered.size },
                  "[linkedin] discovered jobs",
                );
                if (discovered.size >= maxJobs) break searchLoop;
                if (results.length === 0 || newOnPage === 0) break;
              }
            }
          }
        }

        for (const result of discovered.values()) {
          if (seenKnownExternalIds.has(result.externalId)) continue;
          logger?.info({ externalId: result.externalId }, "[linkedin] fetching job");
          try {
            const html = await request(canonicalLinkedInJobUrl(result.externalId), options.signal);
            const detail = parseLinkedInJobDetail(html, result);
            if (!detail) {
              failed += 1;
              logger?.warn({ externalId: result.externalId }, "[linkedin] malformed job detail; skipping");
              continue;
            }
            jobs.push(toRawJob(detail, html, parserVersion));
          } catch (error) {
            if (error instanceof HttpError && error.status === 404) {
              expired += 1;
              logger?.info({ externalId: result.externalId }, "[linkedin] expired job; skipping");
              continue;
            }
            if (error instanceof StopLinkedInCollection) throw error;
            failed += 1;
            logger?.error({ externalId: result.externalId, err: error }, "[linkedin] failed job detail; continuing");
          }
        }
      } catch (error) {
        if (error instanceof StopLinkedInCollection) {
          blocked = error.blocked;
          rateLimited = error.rateLimited;
          logger?.warn({ blocked, rateLimited, reason: error.message }, "[linkedin] collection stopped safely");
        } else {
          failed += 1;
          logger?.error({ err: error }, "[linkedin] collection request failed; returning partial results");
        }
      }

      logger?.info(
        {
          searches,
          jobsDiscovered: seenSearchIds.size,
          newCandidates: discovered.size,
          newJobs: jobs.length,
          duplicates: seenKnownExternalIds.size,
          expired,
          failed,
          blocked,
          rateLimited,
        },
        "[linkedin] LinkedIn collection complete",
      );
      return { jobs, seenKnownExternalIds: [...seenKnownExternalIds] };
    },
  };
}
