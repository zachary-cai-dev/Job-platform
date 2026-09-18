import * as cheerio from "cheerio";
import { toEmploymentType, toSalaryPeriod, validDate } from "../shared/fieldMapping.js";
import { fetchText, HttpError, type HttpClientConfig } from "../shared/httpClient.js";
import type { FetchJobsOptions, FetchJobsResult, JobSourceAdapter, RawJobPayload } from "../types.js";
import type { WellfoundJobPosting } from "./types.js";

export interface WellfoundAdapterConfig {
  listingUrls?: string[];
  maxJobs?: number;
  maxPages?: number;
  requestDelayMs?: number;
  parserVersion?: number;
  http?: HttpClientConfig;
}

const DEFAULT_LISTING_URLS = [
  "https://wellfound.com/role/l/software-engineer/europe",
  "https://wellfound.com/role/l/backend-engineer/europe",
  "https://wellfound.com/role/l/full-stack-software-engineer/europe",
  "https://wellfound.com/role/l/software-engineer/united-kingdom",
  "https://wellfound.com/role/l/software-developer/united-kingdom",
];
const DEFAULT_MAX_JOBS = 150;
const DEFAULT_MAX_PAGES = 5;
const DEFAULT_REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function canonicalJobUrl(value: string): string | null {
  try {
    const url = new URL(value, "https://wellfound.com");
    const match = url.pathname.match(/^\/jobs\/(\d+)-[^/]+\/?$/);
    if (url.hostname !== "wellfound.com" || !match) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function extractWellfoundJobUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const canonical = canonicalJobUrl(href);
    if (canonical) urls.add(canonical);
  });
  return [...urls];
}

function findJobPosting(value: unknown): WellfoundJobPosting | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const posting = findJobPosting(item);
      if (posting) return posting;
    }
    return null;
  }
  const object = value as Record<string, unknown>;
  if (object["@type"] === "JobPosting") return object as WellfoundJobPosting;
  if (Array.isArray(object["@graph"])) return findJobPosting(object["@graph"]);
  return null;
}

export function parseWellfoundJobPosting(html: string): WellfoundJobPosting | null {
  const $ = cheerio.load(html);
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    try {
      const posting = findJobPosting(JSON.parse($(element).contents().text()));
      if (posting) return posting;
    } catch {
      // Ignore malformed or unrelated structured-data blocks.
    }
  }
  return null;
}

function addressCountry(value: string | { name?: string } | undefined): string | undefined {
  return typeof value === "string" ? value : value?.name;
}

function locationFromPosting(posting: WellfoundJobPosting): string | undefined {
  const requirements = Array.isArray(posting.applicantLocationRequirements)
    ? posting.applicantLocationRequirements
    : posting.applicantLocationRequirements
      ? [posting.applicantLocationRequirements]
      : [];
  const eligibleLocations = requirements.map(({ name }) => name?.trim()).filter((name): name is string => Boolean(name));
  if (eligibleLocations.length > 0) return eligibleLocations.join(", ");

  const places = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : posting.jobLocation
      ? [posting.jobLocation]
      : [];
  const physicalLocations = places
    .map(({ address }) => {
      if (!address) return undefined;
      return [address.addressLocality, address.addressRegion, addressCountry(address.addressCountry)]
        .filter(Boolean)
        .join(", ");
    })
    .filter((name): name is string => Boolean(name));
  if (physicalLocations.length > 0) return physicalLocations.join("; ");
  return posting.jobLocationType === "TELECOMMUTE" ? "Remote" : undefined;
}

export function mapWellfoundJob(url: string, posting: WellfoundJobPosting, parserVersion = 1): RawJobPayload | null {
  const externalId = String(posting.identifier?.value ?? url.match(/\/jobs\/(\d+)-/)?.[1] ?? "").trim();
  const title = posting.title?.trim();
  const companyName = posting.hiringOrganization?.name?.trim();
  const description = posting.description?.trim();
  if (!externalId || !title || !companyName || !description) return null;

  const salary = posting.baseSalary?.value;
  const employmentType = Array.isArray(posting.employmentType)
    ? posting.employmentType.join(" ")
    : posting.employmentType;
  return {
    externalId,
    sourceUrl: url,
    applyUrl: url,
    rawTitle: title,
    rawLocation: locationFromPosting(posting),
    companyName,
    companyUrl: posting.hiringOrganization?.sameAs,
    description,
    remoteType: posting.jobLocationType === "TELECOMMUTE" ? "FULLY_REMOTE" : "UNKNOWN",
    employmentType: toEmploymentType(employmentType),
    salaryMin: salary?.minValue ?? salary?.value,
    salaryMax: salary?.maxValue ?? salary?.value,
    salaryCurrency: posting.baseSalary?.currency,
    salaryPeriod: toSalaryPeriod(salary?.unitText),
    postedAt: validDate(posting.datePosted),
    rawPayload: { ...posting, parserVersion },
  };
}

function pageUrl(listingUrl: string, page: number): string {
  const url = new URL(listingUrl);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

/**
 * Wellfound permits its public role and job pages in robots.txt. Discovery uses
 * bounded, server-rendered role pages; details come only from schema.org JobPosting
 * JSON-LD. Requests are sequential and stop immediately on 401/403/429 rather than
 * attempting to evade an access control or rate limit.
 */
export function createWellfoundAdapter(config: WellfoundAdapterConfig = {}): JobSourceAdapter {
  const listingUrls = config.listingUrls ?? DEFAULT_LISTING_URLS;
  const maxJobs = config.maxJobs ?? DEFAULT_MAX_JOBS;
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;
  const requestDelayMs = config.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  const parserVersion = config.parserVersion ?? 1;
  const http = { ...config.http, retry429: false };

  return {
    source: "wellfound",
    async fetchJobs(options: FetchJobsOptions = {}): Promise<FetchJobsResult> {
      const discovered = new Map<string, string>();
      const seenKnown = new Set<string>();
      const seenSearchIds = new Set<string>();
      let blocked = false;

      for (const listingUrl of listingUrls) {
        for (let page = 1; page <= maxPages && discovered.size < maxJobs && !blocked; page++) {
          let html: string;
          try {
            html = await fetchText(pageUrl(listingUrl, page), http);
          } catch (error) {
            if (error instanceof HttpError && [401, 403, 429].includes(error.status)) {
              console.warn(`[wellfound] access stopped with HTTP ${error.status}`);
              blocked = true;
              break;
            }
            throw error;
          }

          const urls = extractWellfoundJobUrls(html);
          let newOnPage = 0;
          for (const url of urls) {
            const externalId = url.match(/\/jobs\/(\d+)-/)?.[1];
            if (!externalId || seenSearchIds.has(externalId)) continue;
            seenSearchIds.add(externalId);
            newOnPage += 1;
            if (options.knownExternalIds?.has(externalId)) seenKnown.add(externalId);
            else {
              discovered.set(externalId, url);
            }
            if (discovered.size >= maxJobs) break;
          }
          if (urls.length === 0 || newOnPage === 0) break;
          await sleep(requestDelayMs);
        }
      }

      const jobs: RawJobPayload[] = [];
      for (const [externalId, url] of discovered) {
        try {
          const html = await fetchText(url, http);
          const posting = parseWellfoundJobPosting(html);
          const job = posting ? mapWellfoundJob(url, posting, parserVersion) : null;
          if (job) jobs.push(job);
          else console.warn(`[wellfound] malformed or missing JobPosting data for ${externalId}`);
        } catch (error) {
          if (error instanceof HttpError && error.status === 404) continue;
          if (error instanceof HttpError && [401, 403, 429].includes(error.status)) {
            console.warn(`[wellfound] detail collection stopped with HTTP ${error.status}`);
            break;
          }
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[wellfound] failed to fetch ${externalId}: ${message}`);
        }
        await sleep(requestDelayMs);
      }

      return { jobs, seenKnownExternalIds: [...seenKnown] };
    },
  };
}
